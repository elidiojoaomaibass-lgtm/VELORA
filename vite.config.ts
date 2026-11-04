import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createClient } from '@supabase/supabase-js';

function apiSettingsDevPlugin(env: Record<string, string>) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

  return {
    name: 'api-settings-dev-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const rawUrl = req.url || '';
        if (rawUrl.startsWith('/api/settings')) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.end();
            return;
          }

          const parsedUrl = new URL(rawUrl, 'http://localhost');
          const email = (parsedUrl.searchParams.get('email') || '').trim().toLowerCase();

          if (req.method === 'GET') {
            if (!email) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'email is required' }));
              return;
            }

            if (!supabase) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, settings: { user_email: email } }));
              return;
            }

            try {
              const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_email', email)
                .maybeSingle();

              if (error) throw error;

              let extra: any = {};
              let webhookEvents: any = { sale_approved: true, sale_pending: false, sale_refunded: false, affiliate_request: true };
              if (data?.webhook_events) {
                try {
                  const ev = typeof data.webhook_events === 'string' ? JSON.parse(data.webhook_events) : data.webhook_events;
                  if (ev._extra) extra = ev._extra;
                  webhookEvents = { ...webhookEvents, ...ev };
                  delete webhookEvents._extra;
                } catch {}
              }

              const settings = data ? {
                user_email: data.user_email || email,
                webhook_url: data.webhook_url || '',
                webhook_events: webhookEvents,
                lowtrack_token: data.lowtrack_token || '',
                facebook_pixel_id: data.facebook_pixel_id || '',
                tiktok_pixel_id: data.tiktok_pixel_id || '',
                utmify_token: data.utmify_token || extra.utmify_token || '',
                google_ads_id: data.google_ads_id || extra.google_ads_id || '',
                whatsapp_token: data.whatsapp_token || extra.whatsapp_token || '',
                klaviyo_token: data.klaviyo_token || extra.klaviyo_token || '',
                b2c_client_id: data.b2c_client_id || extra.b2c_client_id || '',
                b2c_client_secret: data.b2c_client_secret || extra.b2c_client_secret || '',
                b2c_wallet_id: data.b2c_wallet_id || extra.b2c_wallet_id || '',
                b2c_environment: data.b2c_environment || extra.b2c_environment || 'production',
                phone_number: data.phone_number || extra.phone_number || '',
                full_name: data.full_name || extra.full_name || '',
                nickname: data.nickname || extra.nickname || '',
                document_id: data.document_id || extra.document_id || '',
              } : { user_email: email };

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, settings }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          if (req.method === 'POST') {
            const chunks: any[] = [];
            for await (const chunk of req) chunks.push(chunk);
            let body: any = {};
            try {
              body = JSON.parse(Buffer.concat(chunks).toString());
            } catch {}

            const targetEmail = (body.email || email).trim().toLowerCase();
            const updates = body.settings || {};

            if (!targetEmail) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'email is required' }));
              return;
            }

            if (!supabase) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, settings: { user_email: targetEmail, ...updates } }));
              return;
            }

            try {
              const { data: existing } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_email', targetEmail)
                .maybeSingle();

              let extra: any = {};
              let webhookEvents: any = { sale_approved: true, sale_pending: false, sale_refunded: false, affiliate_request: true };
              if (existing?.webhook_events) {
                try {
                  const ev = typeof existing.webhook_events === 'string' ? JSON.parse(existing.webhook_events) : existing.webhook_events;
                  if (ev._extra) extra = ev._extra;
                  webhookEvents = { ...webhookEvents, ...ev };
                } catch {}
              }

              if (updates.webhook_events) {
                webhookEvents = { ...webhookEvents, ...updates.webhook_events };
              }

              const extraFields = ['utmify_token', 'google_ads_id', 'whatsapp_token', 'klaviyo_token', 'b2c_client_id', 'b2c_client_secret', 'b2c_wallet_id', 'b2c_environment', 'phone_number', 'full_name', 'nickname', 'document_id'];
              for (const key of extraFields) {
                if (updates[key] !== undefined) {
                  extra[key] = updates[key];
                }
              }

              const rowToSave: any = {
                user_email: targetEmail,
                webhook_events: JSON.stringify({ ...webhookEvents, _extra: extra }),
              };

              if (updates.webhook_url !== undefined) rowToSave.webhook_url = updates.webhook_url;
              if (updates.lowtrack_token !== undefined) rowToSave.lowtrack_token = updates.lowtrack_token;
              if (updates.facebook_pixel_id !== undefined) rowToSave.facebook_pixel_id = updates.facebook_pixel_id;
              if (updates.tiktok_pixel_id !== undefined) rowToSave.tiktok_pixel_id = updates.tiktok_pixel_id;
              if (updates.phone_number !== undefined) rowToSave.phone_number = updates.phone_number;

              const { error: saveErr } = await supabase
                .from('user_settings')
                .upsert(rowToSave, { onConflict: 'user_email' });

              if (saveErr) throw saveErr;

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, settings: { ...updates, user_email: targetEmail } }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      watch: {
        ignored: ['**/_archive/**', '**/node_modules/**', '**/api/**'],
      },
      proxy: {
        '/api/catbox': {
          target: 'https://catbox.moe',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/catbox/, '/user/api.php')
        },
        '/api/lowtrack-proxy': {
          target: 'https://lowtrack.com.br',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/lowtrack-proxy/, '/sales')
        },
        '/api/kwikpay-proxy': {
          target: 'https://mpesaemolatech.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/kwikpay-proxy/, '')
        },
        '/api/payment-proxy': {
          target: 'https://mpesaemolatech.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/payment-proxy/, '')
        }
      }
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-charts': ['recharts'],
            'vendor-motion': ['framer-motion'],
          }
        }
      }
    },
    plugins: [
      react(),
      apiSettingsDevPlugin(env),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png', 'vite.svg'],
        manifest: {
          name: 'VELORA',
          short_name: 'VELORA',
          description: 'Plataforma de Pagamentos VELORA',
          theme_color: '#0d0d17',
          background_color: '#0d0d17',
          display: 'standalone',
          icons: [
            {
              src: '/logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
  };
});
