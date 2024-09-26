
let API_BASE_URL = '';

export function setApiBaseUrl(url: string) {
    API_BASE_URL = url;
}

export function getApiBaseUrl(): string {
    return API_BASE_URL;
}