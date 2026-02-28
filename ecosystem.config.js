module.exports = {
    apps: [
        {
            name: 'app-frontend',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            cwd: '/var/www/app-frontend',
            instances: 'max',
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 3005
            }
        }
    ]
};
