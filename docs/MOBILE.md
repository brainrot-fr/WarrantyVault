# Mobile app setup

WarrantyVault uses Capacitor 8. The app ID is `app.vercel.warrantyvault1729` and is shared by the Capacitor config and native auth URL scheme. Avoid changing it after creating store listings.

## Local development

1. Install Node dependencies with `npm install`.
2. Build the web app with `npm run build`.
3. Generate and open the Android project with `npx cap sync android` and `npx cap open android`. Android Studio and an Android SDK are required to run it.
4. For iOS, run `npx cap sync ios` and `npx cap open ios` on macOS with Xcode and CocoaPods. The iOS project is scaffolded but has not been built or tested in this Linux environment.
5. After changing web code or Capacitor plugins, run `npm run build` followed by `npx cap sync`.

The browser app continues to use the file picker, and native builds add camera capture. Claim packs download in the browser and use the native share sheet on Android/iOS. The share sheet receives a temporary file from the app cache.

## Native sign-in links

The native client stores Supabase PKCE sessions with `@capacitor/preferences`; web continues to use the browser storage default. Native OAuth opens the provider in Capacitor Browser and exchanges the returned authorization code after the app receives its custom-scheme URL.

In Supabase Authentication URL Configuration, add these exact redirect URLs to the allow list:

- `app.vercel.warrantyvault1729://auth/callback*`
- `app.vercel.warrantyvault1729://auth/reset`

Google sign-in preserves the in-app return path in the callback query, so the callback allow-list entry includes the query string with `*`.

In Google Cloud Console, keep the Supabase OAuth callback configured for the Google provider. Supabase must also allow the custom-scheme redirects above. For web builds, keep the deployed web URLs and local development callback URLs in the Supabase allow list.

## iOS permissions and review

Before a device build, set meaningful values for `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, and `NSPhotoLibraryAddUsageDescription` in the iOS app's `Info.plist`. Review the generated iOS project and plugin privacy manifests before submission; Capacitor Filesystem documents `NSPrivacyAccessedAPICategoryFileTimestamp` reason `C617.1`, and Preferences may require the UserDefaults declaration. Keep the final manifest aligned with the APIs and plugins actually present in the submitted app.

Apple App Review Guideline 5.1.1(v) requires apps that support account creation to let users initiate deletion of their account within the app. Settings currently has sign-out but no account-deletion flow, so an App Store submission must wait until account deletion is implemented and tested.
