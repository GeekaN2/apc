# Dev build of the APC rewrite: static apps/web/dist, published by
# deploy/deploy.sh, and the new API on 127.0.0.1:4100.
# Install as root:
#   cp deploy/nginx/dev.albion-profit-calculator.com /etc/nginx/sites-available/
#   nginx -t && systemctl reload nginx
proxy_cache_path /var/lib/nginx/apc-item-icons levels=1:2 keys_zone=apc_item_icons:16m
    max_size=1g inactive=30d use_temp_path=off;

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

    location ~ "^/item-icons/(?<icon_size>32|48|64|96)/(?<icon_quality>[1-5])/(?<icon_id>[A-Z0-9_]{1,100}(?:@[0-9])?)\.png$" {
        limit_except GET { deny all; }

        set $args "size=$icon_size&quality=$icon_quality";
        rewrite ^ /v1/item/$icon_id.png break;
        proxy_pass https://render.albiononline.com;
        proxy_ssl_server_name on;
        proxy_ssl_verify on;
        proxy_ssl_verify_depth 3;
        proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
        proxy_pass_request_headers off;
        proxy_pass_request_body off;
        proxy_set_header Host render.albiononline.com;
        proxy_set_header Content-Length "";
        proxy_connect_timeout 4s;
        proxy_read_timeout 10s;

        proxy_cache apc_item_icons;
        proxy_cache_key $uri$is_args$args;
        proxy_cache_lock on;
        proxy_cache_lock_timeout 12s;
        proxy_cache_lock_age 12s;
        proxy_cache_background_update on;
        proxy_cache_use_stale error timeout updating http_429 http_500 http_502 http_503 http_504;
        proxy_cache_valid 200 7d;
        proxy_cache_valid 404 10m;
        proxy_ignore_headers Cache-Control Expires;
        proxy_hide_header Cache-Control;
        proxy_hide_header Expires;
        proxy_hide_header Set-Cookie;
        add_header Cache-Control "public, max-age=86400, no-transform";
        add_header X-Item-Cache $upstream_cache_status always;
    }

    location /item-icons/ {
        return 404;
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
