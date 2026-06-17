FROM php:8.3-fpm-alpine

RUN apk add --no-cache \
    postgresql-dev \
    linux-headers \
    libpng-dev \
    libzip-dev \
    icu-dev \
    oniguruma-dev \
    zip \
    unzip \
    git

RUN docker-php-ext-install \
    pdo_pgsql \
    pgsql \
    intl \
    mbstring \
    gd \
    zip \
    opcache \
    pcntl

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Entrypoint en /usr/local/bin: queda FUERA del volumen ./backend:/var/www/html,
# asi nunca lo oculta el mount y se normaliza a LF (evita problemas de CRLF
# cuando el proyecto se clona/crea en Windows).
COPY entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /var/www/html

COPY . .

RUN mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html/storage \
    && chmod -R 755 /var/www/html/bootstrap/cache

EXPOSE 9000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["php-fpm"]
