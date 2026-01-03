This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Testing from other devices on the same network
If you want to access the dev server from your mobile or another PC on the same Wi‑Fi:

- Set your machine to listen on all interfaces and start the dev server (PowerShell):
  - `$env:HOST = '0.0.0.0'; npm run dev` (or `npm run dev -- -p 3000` for a specific port)
- Ensure `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_PRINT_AGENT_URL` in `.env.local` point to your machine's LAN IP (e.g. `http://192.168.1.8:5000` and `http://192.168.1.8:9100`).
- If Windows Firewall blocks access, run PowerShell as admin and allow the port (example):
  - `New-NetFirewallRule -DisplayName "Next.js Dev" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow`
- Open the site on your phone at `http://<YOUR_PC_IP>:3000` (for example `http://192.168.1.8:3000`).

Note: Restart the dev server after changing `.env.local` so Next picks up the new environment variables.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
