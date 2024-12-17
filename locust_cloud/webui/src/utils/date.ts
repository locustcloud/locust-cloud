export const utcNow = () => new Date().toISOString().replace('T', ' ').split('.')[0];
