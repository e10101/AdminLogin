# Login Auth

## Configuration
### config.js
You should rename the file `config-sample.js` to `config.js` first.
Then you should change the content of `config.js` to your settings.

### Nginx confs
**login.example.com conf**

```nginx
server {
	listen 80;
	listen [::]:80;

    server_name  login.example.com;

    location / {
      proxy_set_header  Host $host;
      proxy_set_header  X-Real-IP $remote_addr;
      proxy_set_header  X-Forwarded-Proto https;
      proxy_set_header  X-Forwarded-For $remote_addr;
      proxy_set_header  X-Forwarded-Host $remote_addr;
      proxy_pass    http://127.0.0.1:4001/;
    }
}
```

**server1.example.com conf**

```nginx
server {
	listen 80;
	listen [::]:80;

    server_name  server1.example.com;

    location = /auth {
        internal;
        proxy_pass http://login.example.com;

        proxy_pass_request_body     off;

        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    error_page 401 = @error401;
    location @error401 {
        return 302 http://login.example.com;
    }
    location / {
        try_files $uri $uri/ @proxy;
    }

	# The path has secret content
    location /installs {
        auth_request /auth;
        try_files $uri $uri/ @proxy;
    }

    location @proxy {
    	proxy_set_header  Host $host;
    	proxy_set_header  X-Real-IP $remote_addr;
    	proxy_set_header  X-Forwarded-Proto https;
    	proxy_set_header  X-Forwarded-For $remote_addr;
    	proxy_set_header  X-Forwarded-Host $remote_addr;
    	proxy_pass    http://127.0.0.1:3003;
    }
}
```

## Author
Yishi Guo

## 中文说明 (Chinese Docs)
### 开发初衷
这个项目是为了解决网站中部分管理资源(路径)需要进行权限限制,但又不想通过复杂系统去实现而进行编写的项目.

同时这个项目也没有采用`Nginx`的`auth_basic`模块来实现权限限制.二是通过`auth_request`来进行的权限限制.

### 结构框架
本项目是基于`NodeJS`/`ExpressJS`/`PassportJS`以及**Github**的。

为讲解方便，假设存在:

 - **服务器A**(server1.example.com)，其路径`/installs`上存有敏感信息，其他路径可公开访问，端口3003。

 - **服务器B**(login.example.com)，为认证服务器，其上部署了本项目代码，端口4001。

系统以`CentOS`7.2为例，认证使用的**Github**用户认证。

### 示意配置

**服务器A**(server1)的Nginx配置文件

```nginx
server {
	listen 80;
	listen [::]:80;

    server_name  server1.example.com;

    location = /auth {
        internal;
        proxy_pass http://login.example.com;

        proxy_pass_request_body     off;

        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    error_page 401 = @error401;
    location @error401 {
        return 302 http://login.example.com;
    }
    location / {
        try_files $uri $uri/ @proxy;
    }

	# The path has secret content
    location /installs {
        auth_request /auth;
        try_files $uri $uri/ @proxy;
    }

    location @proxy {
    	proxy_set_header  Host $host;
    	proxy_set_header  X-Real-IP $remote_addr;
    	proxy_set_header  X-Forwarded-Proto https;
    	proxy_set_header  X-Forwarded-For $remote_addr;
    	proxy_set_header  X-Forwarded-Host $remote_addr;
    	proxy_pass    http://127.0.0.1:3003;
    }
}
```

**服务器B**(login)的Nginx配置

```nginx
server {
	listen 80;
	listen [::]:80;

    server_name  login.example.com;

    location / {
    	proxy_set_header  Host $host;
    	proxy_set_header  X-Real-IP $remote_addr;
    	proxy_set_header  X-Forwarded-Proto https;
    	proxy_set_header  X-Forwarded-For $remote_addr;
    	proxy_set_header  X-Forwarded-Host $remote_addr;
    	proxy_pass    http://127.0.0.1:4001/;
    }
}
```

### 基本流程

 - 用户访问服务器A的敏感资源（即路径`/installs`中的内容），`Nginx`通过配置文件中的`auth_request`字段去请求 http://login.example.com/auth ，由于用户并未在服务器B进行登录，因此服务器B返回了`401`无权限的错误。
 - 根据服务器A的配置，发现`401`错误后，会向用户返回`302`状态指向为服务器B的主机地址（login.example.com）。
 - 用户浏览器跳转到服务器B，并选择第三方的用户认证进行授权（此处以Github为例），当用户通过Github进行授权后，回向服务器B返回用户的个人信息。
 - 服务器B从第三方反馈回的信息中，检索出用户的用户名（`username`），然后服务器B会将此用户名与已有的管理员信息进行对比（此处通过配置文件实现），如果登录用户为合法的管理员账号，则服务器B授权其登录进入。如果为非法用户，则不对其授权，因此非法用户无法获得有效登录凭证。
   - **如果用户为合法用户：**
     - 那么服务器B将会生成session，并通过`Set-cookie`命令告知用户浏览器。用户通过此Cookie即可获得服务器B的认可授权。当用户通过此Cookie访问服务器B中的`/auth`目录时，会返回`200`的状态码。
   - **如果用户为非法用户：**
     - 那么服务器B将不会session，由于用户无法获得认可的Cookie，那么当用户再次访问`/auth`的路径时，服务器会返回`401`错误。
 - 假设用户已经授权成功，那么当用户访问服务器A中的敏感内容`/installs`时，服务器A访问服务器B的`/auth`路径，此时返回`200`状态码，服务器A则允许用户进行访问。

以上，通过`auth_request`模块以及相关配置就实现了对敏感内容的访问限制。而且通过第三方的机制，也无需自己手工实现登录功能。
同时，此方案可以对同一域名下的不同子域名中的内容进行访问限制。可以重复利用一个登录系统，服务于多个其他系统。

### 注意事项
 - 设置`Express`的session时，由于本案例中使用了不同的子域名（server1.example.com 及 login.example.com），需要特别设置`cookie`的`domain`项，如下所示：
    ```javascript
    app.use(session({ 
      secret: config.session.secret,
      cookie: {
        path: config.cookie.path,
        domain: config.cookie.domain,
        maxAge: config.cookie.maxAge
      }
    }));
    ```
    其中的domain格式为：`.example.com`。
    
 - **关于为何使用Github的问题。**
   1. 国内可以访问（此项排除了Facebook,Google,Twitter等）；
   2. 创建应用简单无需审核（此项排除了微信,微博等）。