FROM php:8.3-apache

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    default-mysql-client \
    git \
    gnupg \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    libpng-dev \
    libzip-dev \
    pkg-config \
    unzip \
    zip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install exif gd mysqli pdo_mysql zip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs \
    && npm install -g grunt-cli \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

RUN a2enmod rewrite

RUN sed -ri 's!/var/www/html!/workspace/site!g' /etc/apache2/sites-available/000-default.conf \
    && printf '<Directory /workspace/site>\nAllowOverride All\nRequire all granted\n</Directory>\n' > /etc/apache2/conf-available/workspace-site.conf \
    && a2enconf workspace-site

WORKDIR /workspace
