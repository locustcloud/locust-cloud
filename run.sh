if [ ! -z "$LOCUSTCLOUD_REQUIREMENTS_URL" ]; then
    # Use Python since it will be available in the Docker environment
    python -c "import urllib.request; urllib.request.urlretrieve('$LOCUSTCLOUD_REQUIREMENTS_URL', 'requirements.txt')"

    if [ -f requirements.txt ]; then
        echo "Installing external requirements"
        pip install -r requirements.txt
        rm requirements.txt

        echo "External requirements installed"
    else
        echo "Failed to download requirements.txt. Skipping installation."
    fi
fi

exec locust $LOCUST_FLAGS
