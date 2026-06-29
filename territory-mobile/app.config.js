// Dynamic Expo config. Extends the static app.json and injects the Google Maps
// Android key from an environment variable, so the key is never committed.
//   Local dev:   set GOOGLE_MAPS_API_KEY in territory-mobile/.env (gitignored)
//   EAS builds:  set it as an EAS environment variable (eas env:create)
export default ({ config }) => ({
    ...config,
    android: {
        ...config.android,
        config: {
            ...(config.android && config.android.config),
            googleMaps: {
                apiKey: process.env.GOOGLE_MAPS_API_KEY,
            },
        },
    },
});
