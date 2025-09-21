FROM php:8.2-apache

RUN apt-get update
RUN docker-php-ext-install mysqli && docker-php-ext-enable mysqli
RUN apt-get update && apt-get install -y
