#!/usr/bin/env bash

prepare_backup_db_url() {
    SUPABASE_DB_URL="${SUPABASE_DB_URL:-}"
    SUPABASE_DB_URL="${SUPABASE_DB_URL//$'\r'/}"
    SUPABASE_DB_URL="${SUPABASE_DB_URL//$'\n'/}"
    SUPABASE_DB_URL="${SUPABASE_DB_URL#"${SUPABASE_DB_URL%%[![:space:]]*}"}"
    SUPABASE_DB_URL="${SUPABASE_DB_URL%"${SUPABASE_DB_URL##*[![:space:]]}"}"
    if [[ "$SUPABASE_DB_URL" == \"*\" || "$SUPABASE_DB_URL" == \'*\' ]]; then
        SUPABASE_DB_URL="${SUPABASE_DB_URL:1:${#SUPABASE_DB_URL}-2}"
    fi

    local errors=0 connection user server host port database
    BACKUP_DB_PASSWORD=''
    if [[ ! "$SUPABASE_DB_URL" =~ ^postgres(ql)?:// ]]; then
        echo '::error::SUPABASE_DB_URL scheme must start with postgresql:// or postgres://.'
        errors=1
    fi

    connection="${SUPABASE_DB_URL#*://}"
    if [[ "$connection" != *:*@* ]]; then
        echo '::error::SUPABASE_DB_URL user/password section must have the shape <user>:<password>@.'
        return 1
    fi
    user="${connection%%:*}"
    BACKUP_DB_PASSWORD="${connection#*:}"
    BACKUP_DB_PASSWORD="${BACKUP_DB_PASSWORD%@*}"
    if [[ ! "$user" =~ ^[^:/?#@[:space:]]+$ ]]; then
        echo '::error::SUPABASE_DB_URL user must be non-empty and contain no URL delimiters or whitespace.'
        errors=1
    fi
    if [[ -z "$BACKUP_DB_PASSWORD" ]]; then
        echo '::error::SUPABASE_DB_URL password must be non-empty.'
        errors=1
    elif [[ ! "$BACKUP_DB_PASSWORD" =~ ^([^%#?/@[:space:]]|%[[:xdigit:]]{2})+$ ]]; then
        echo '::error::SUPABASE_DB_URL: the password contains characters that must be percent-encoded (for example @ → %40, # → %23, % → %25)'
        errors=1
    fi
    if [[ "$BACKUP_DB_PASSWORD" == *CONTRASE* || "$BACKUP_DB_PASSWORD" == *PASSWORD* || "$BACKUP_DB_PASSWORD" == *YOUR-PASSWORD* ]]; then
        echo '::error::SUPABASE_DB_URL password contains a placeholder; replace it with the percent-encoded database password.'
        errors=1
    fi

    server="${connection##*@}"
    database=''
    if [[ "$server" == */* ]]; then
        database="${server#*/}"
        server="${server%%/*}"
    fi
    host="$server"
    port=''
    if [[ "$server" == *:* ]]; then
        host="${server%:*}"
        port="${server##*:}"
    fi
    if [[ ! "$host" =~ ^[^:/?#@[:space:]]+$ ]]; then
        echo '::error::SUPABASE_DB_URL host must be non-empty and contain no URL delimiters or whitespace.'
        errors=1
    fi
    if [[ ! "$port" =~ ^[0-9]+$ ]]; then
        echo '::error::SUPABASE_DB_URL port must be non-empty and contain only digits.'
        errors=1
    fi
    if [[ ! "$database" =~ ^[^/?#@[:space:]]+$ ]]; then
        echo '::error::SUPABASE_DB_URL database must be non-empty and contain no path/query delimiters or whitespace.'
        errors=1
    fi
    return "$errors"
}
