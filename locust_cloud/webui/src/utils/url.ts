export const pushQuery = (query: { [key: string]: string }) => {
  const url = new URL(window.location.href);

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  window.history.pushState(null, '', url);
};

export const removeQuery = (key: string) => {
  const url = new URL(window.location.href);

  url.searchParams.delete(key);

  window.history.pushState(null, '', url);
};

export const createAbsoluteUrl = (query: { [key: string]: string }) => {
  const url = new URL(window.location.href);

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  return url;
};
