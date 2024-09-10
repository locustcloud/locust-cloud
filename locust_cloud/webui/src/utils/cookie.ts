const getCookiesObject = (cookies?: string) => {
  return cookies
    ? cookies
        .split(';')
        .map(cookie => cookie.trim().split('='))
        .reduce(
          (cookiesObject: Record<string, string>, [cookieKey, cookieValue]) => ({
            ...cookiesObject,
            [cookieKey]: cookieValue,
          }),
          {},
        )
    : {};
};

export const getCookie = (key: string) =>
  typeof document !== 'undefined' && getCookiesObject(document.cookie)[key];
