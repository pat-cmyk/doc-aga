/**
 * Type declarations for capacitor-native-settings
 * This stub allows cloud builds to succeed while the actual package
 * is only installed in native Android/iOS environments.
 */
declare module 'capacitor-native-settings' {
  export const NativeSettings: {
    open(options: {
      optionAndroid: AndroidSettings;
      optionIOS: IOSSettings;
    }): Promise<void>;
  };

  export enum AndroidSettings {
    ApplicationDetails = 'application_details',
    Accessibility = 'accessibility',
    Application = 'application',
    ApplicationDevelopment = 'application_development',
    ApplicationNotification = 'application_notification',
    BatteryOptimization = 'battery_optimization',
    Bluetooth = 'bluetooth',
    CaptioningSettings = 'captioning',
    CastSettings = 'cast',
    DataRoaming = 'data_roaming',
    Date = 'date',
    Display = 'display',
    Home = 'home',
    Keyboard = 'keyboard',
    KeyboardSubType = 'keyboard_subtype',
    Locale = 'locale',
    Location = 'location',
    ManageAllApplications = 'manage_all_applications',
    ManageApplications = 'manage_applications',
    MemoryCard = 'memory_card',
    Network = 'network',
    NfcSettings = 'nfc_settings',
    NightDisplay = 'night_display',
    Notification = 'notification',
    Print = 'print',
    Privacy = 'privacy',
    QuickLaunch = 'quick_launch',
    Search = 'search',
    Security = 'security',
    Settings = 'settings',
    ShowRegulatoryInfo = 'show_regulatory_info',
    Sound = 'sound',
    Storage = 'storage',
    Store = 'store',
    Sync = 'sync',
    Usage = 'usage',
    UserDictionary = 'user_dictionary',
    VoiceInput = 'voice_input',
    Wifi = 'wifi',
    WifiIp = 'wifi_ip',
    Wireless = 'wireless',
  }

  export enum IOSSettings {
    App = 'app',
    About = 'about',
    Accessibility = 'accessibility',
    AirplaneMode = 'airplane_mode',
    Autolock = 'autolock',
    Bluetooth = 'bluetooth',
    DateTime = 'date_time',
    FaceTime = 'facetime',
    General = 'general',
    Keyboard = 'keyboard',
    iCloud = 'icloud',
    iCloudStorageBackup = 'icloud_storage_backup',
    International = 'international',
    LocationServices = 'location_services',
    Music = 'music',
    Notes = 'notes',
    Notification = 'notification',
    Phone = 'phone',
    Photos = 'photos',
    ManagedConfigurationList = 'managed_configuration_list',
    Reset = 'reset',
    Ringtone = 'ringtone',
    Safari = 'safari',
    Siri = 'siri',
    Sounds = 'sounds',
    SoftwareUpdate = 'software_update',
    Store = 'store',
    Twitter = 'twitter',
    Usage = 'usage',
    Video = 'video',
    VPN = 'vpn',
    Wallpaper = 'wallpaper',
    Wifi = 'wifi',
  }
}
