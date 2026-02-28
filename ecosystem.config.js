module.exports = {
    apps: [
        {
            name: 'drive-frontend',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            instances: 'max',
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            }
        }
    ]
};
