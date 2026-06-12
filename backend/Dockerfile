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

WORKDIR /var/www/html

COPY . .

RUN if [ -f composer.json ]; then composer install --no-dev --optimize-autoloader --no-interaction; fi

RUN mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html/storage \
    && chmod -R 755 /var/www/html/bootstrap/cache

EXPOSE 9000

CMD ["php-fpm"]
