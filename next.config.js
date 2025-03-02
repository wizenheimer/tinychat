/** @type {import('next').NextConfig} */
const nextConfig = {
    /* config options here */
    reactStrictMode: true,
    webpack: (config, { dev, isServer }) => {
        // This is necessary for WebAssembly compilation which might be needed by tinylm
        config.experiments = {
            asyncWebAssembly: true,
            layers: true,
        };

        // Disable cache in webpack to fix the "Unable to snapshot resolve dependencies" error
        if (!dev) {
            config.cache = false;
        }

        return config;
    },
};

module.exports = nextConfig; 