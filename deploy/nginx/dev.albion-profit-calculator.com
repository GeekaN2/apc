# Dev build of the APC rewrite: static apps/web/dist, published by
# deploy/deploy.sh, and the new API on 127.0.0.1:4100.
# Install as root:
#   cp deploy/nginx/dev.albion-profit-calculator.com /etc/nginx/sites-available/
#   nginx -t && systemctl reload nginx
server {
    listen [::]:443 ssl;
    listen 443 ssl;
    server_name dev.albion-profit-calculator.com;

    ssl_certificate /etc/letsencrypt/live/dev.albion-profit-calculator.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/dev.albion-profit-calculator.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

    root /home/gpt/www/apc-dev/current;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    location /api/ {
        proxy_pass http://127.0.0.1:4100;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # File names contain a content hash
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # Client-side routes of the SPA
    location / {
        add_header Cache-Control "no-cache";
        try_files $uri /index.html;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name dev.albion-profit-calculator.com;

    return 301 https://$host$request_uri;
}
