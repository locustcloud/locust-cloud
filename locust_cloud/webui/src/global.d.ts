declare global {
    interface ISwarmState {
        api_base_url: string;
    }

    interface Window {
        templateArgs: ISwarmState;
    }
}

export { };