module.exports = {
  apps: [
    {
      name: 'charpsdev-frontend',
      script: 'npx',
      args: 'next start -p 3000 -H 0.0.0.0',
      cwd: '/home/user/charpsdev-vercel-railway-package/frontend',
      env: { NODE_ENV: 'production', PORT: 3000 },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
