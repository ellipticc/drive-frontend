module.exports = {
    apps: [
        {
            name: 'app-frontend',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            cwd: '/var/www/app-frontend',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                PORT: 3005
            }
        }
    ]
};
