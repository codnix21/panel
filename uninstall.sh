#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

INSTALL_DIR="/opt/mtproto-panel"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTProto Panel — Удаление              ${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Ошибка: запустите скрипт от root (sudo).${NC}"
    exit 1
fi

echo -e "${YELLOW}Будут удалены:${NC}"
echo -e "  - Docker-контейнеры и образы панели"
echo -e "  - Данные базы данных (volume)"
echo -e "  - Каталог ${INSTALL_DIR}"
echo -e "  - SSL-сертификаты (если были созданы)"
echo -e "  - Cron-задачи certbot (если были)"
echo ""
read -p "Вы уверены? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo -e "${CYAN}Отменено.${NC}"
    exit 0
fi

echo ""

# Stop and remove containers
PANEL_DIR="${INSTALL_DIR}/panel"
if [ -f "${PANEL_DIR}/docker-compose.yml" ]; then
    echo -e "${CYAN}[1/5] Остановка и удаление контейнеров...${NC}"
    cd "$PANEL_DIR"
    docker compose down -v --rmi local 2>/dev/null || true
    echo -e "${GREEN}  Контейнеры удалены.${NC}"
else
    echo -e "${YELLOW}[1/5] docker-compose.yml не найден, пропуск...${NC}"
fi

# Remove self-signed certs
if [ -d "${PANEL_DIR}/ssl" ]; then
    echo -e "${CYAN}[2/5] Удаление самоподписанных сертификатов...${NC}"
    rm -rf "${PANEL_DIR}/ssl"
    echo -e "${GREEN}  Удалены.${NC}"
else
    echo -e "${YELLOW}[2/5] Самоподписанных сертификатов нет, пропуск...${NC}"
fi

# Remove certbot cron and LE certs
echo -e "${CYAN}[3/5] Очистка Let's Encrypt...${NC}"
if crontab -l 2>/dev/null | grep -q "certbot renew"; then
    crontab -l 2>/dev/null | grep -v "certbot renew" | crontab -
    echo -e "${GREEN}  Cron-задача certbot удалена.${NC}"
fi
# Remove LE certs only if they were issued for this panel
if [ -f "${PANEL_DIR}/.env" ]; then
    SSL_DOMAIN=$(grep "^SSL_DOMAIN=" "${PANEL_DIR}/.env" 2>/dev/null | cut -d= -f2)
    if [ -n "$SSL_DOMAIN" ] && [ -d "/etc/letsencrypt/live/${SSL_DOMAIN}" ]; then
        read -p "Удалить сертификат LE для ${SSL_DOMAIN}? (y/N): " DEL_CERT
        if [ "$DEL_CERT" = "y" ] || [ "$DEL_CERT" = "Y" ]; then
            certbot delete --cert-name "$SSL_DOMAIN" --non-interactive 2>/dev/null || rm -rf "/etc/letsencrypt/live/${SSL_DOMAIN}" "/etc/letsencrypt/renewal/${SSL_DOMAIN}.conf" "/etc/letsencrypt/archive/${SSL_DOMAIN}"
            echo -e "${GREEN}  Сертификат LE удалён.${NC}"
        fi
    fi
fi

# Remove install directory
echo -e "${CYAN}[4/5] Удаление каталога ${INSTALL_DIR}...${NC}"
if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo -e "${GREEN}  Каталог удалён.${NC}"
else
    echo -e "${YELLOW}  Каталог не найден, пропуск...${NC}"
fi

# Prune dangling images
echo -e "${CYAN}[5/5] Очистка неиспользуемых Docker-образов...${NC}"
docker image prune -f 2>/dev/null || true
echo -e "${GREEN}  Готово.${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Панель полностью удалена.             ${NC}"
echo -e "${GREEN}========================================${NC}"
