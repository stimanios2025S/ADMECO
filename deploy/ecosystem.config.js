// ═══════════════════════════════════════════════════════════
// PM2 — APPLICATION ADMEDCO (Next.js)
//
// Ce fichier ne déclare QU'ADMEDCO. Il ne touche ni à wa-gateway:3000
// ni à rmasc-onsite:4002 : `pm2 start deploy/ecosystem.config.js`
// ajoute une application, il n'en redémarre aucune autre.
//
// Le nom suit la convention déjà en place sur le serveur,
// « <projet>:<port> » — d'où « admedco:4003 ».
//
// Le port est choisi à 4003 : 3000 est pris par wa-gateway et 4002 par
// rmasc-onsite. Ne pas réutiliser ces deux ports.
// ═══════════════════════════════════════════════════════════

module.exports = {
  apps: [
    {
      name: "admedco:4003",
      cwd: "/opt/admedco",
      script: "npm",
      args: "start",

      env: {
        NODE_ENV: "production",
        PORT: "4003",
      },

      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      // Le build Next.js d'ADMEDCO est volumineux ; on redémarre proprement
      // plutôt que de laisser le processus gonfler jusqu'à l'OOM killer.
      max_memory_restart: "1G",

      // Journalisation séparée des deux autres applications.
      output: "/var/log/admedco/out.log",
      error: "/var/log/admedco/err.log",
      merge_logs: true,
      time: true,

      // Laisser le temps au serveur Next.js d'ouvrir le port avant que PM2
      // ne considère le démarrage comme un échec.
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
  ],
};
