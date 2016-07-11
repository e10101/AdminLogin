// rename this file to config.js

var config = {};
config.github = {
    client_id: 'GITHUB_CLIENT_ID',
    client_secret: 'GITHUB_CLIENT_SECRET',
    callback_url: 'GITHUB_CALLBACK_URL'
};

config.admins = {
    github: [
        'ADMIN_USER_NAME_1',
        'ADMIN_USER_NAME_2'
    ]
};

config.session = {
    secret: 'SECRET_STRING'
};

config.cookie = {
    domain: 'THE_DOMAIN_NAME_WHICH_SHARES_SESSION', // .example.com
    maxAge: 1000 * 3600 * 24, // 24 hours
    path: '/'
};

module.exports = config;