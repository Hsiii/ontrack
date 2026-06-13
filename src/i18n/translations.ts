import type { LanguageOption } from './types';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'en', label: 'English' },
];

export const translations = {
    'zh-TW': {
        'app.title': 'OnTrack',
        'app.selectRoute': '選擇路線',
        'app.selectTrain': '選擇班次',
        'app.searchStation': '搜尋車站',
        'app.switchToEnglish': '切換成英文',
        'app.switchToChinese': '切換成中文',
        'app.enableAutoDetectOrigin': '開啟定位起點',
        'app.disableAutoDetectOrigin': '關閉定位起點',
        'station.origin': '出發站',
        'station.destination': '抵達站',
        'station.selectOrigin': '選擇出發站',
        'station.selectDestination': '選擇抵達站',
        'station.noRecentSearches': '尚無最近搜尋車站',
        'station.noMatches': '找不到符合的車站',
        'toast.geoEnabled': '已開啟定位起點',
        'toast.geoDisabled': '已關閉定位起點',
        'toast.defaultDestSet': '已設定預設抵達站',
        'toast.defaultDestCleared': '已清除預設抵達站',
        'language.openDialog': '開啟語言選單',
        'language.selectTitle': '選擇語言',
        'language.zhTW': '繁體中文',
        'language.en': 'English',
        'time.selectTime': '選擇時間',
        'time.departure': '出發',
        'time.arrival': '抵達',
        'time.date': '日期',
        'time.time': '時間',
        'destinationPrompt.title': '現在要去哪',
        'destinationPrompt.notThese': '不是這些',

        'train.onTime': 'On Time',
        'train.delayMinutes': '+{minutes} min',
        'train.noTrainsAvailable': '查無可搭乘班次',

        'error.failedToLoadSchedule': '無法取得時刻表',
        'error.failedToLoadStations': '無法載入車站資料',
        'common.close': '關閉',
        'common.clear': '清除',
        'common.retry': '重試',

        'share.arrivalMessage': '{time}到{station}',
        'share.noTrainMessage': '好像沒車搭了',

        'iosInstall.title': '加到主畫面',
        'iosInstall.subtitle': '將 {appName} 加入主畫面以享受最佳使用體驗',
        'iosInstall.step1': '點擊底部的「分享」按鈕',
        'iosInstall.step2': '選擇「加入主畫面」',
        'iosInstall.dismiss': '知道了',
    },
    'en': {
        'app.title': 'OnTrack',
        'app.selectRoute': 'Select Route',
        'app.selectTrain': 'Select Train',
        'app.searchStation': 'Search Station',
        'app.switchToEnglish': 'Switch to English',
        'app.switchToChinese': 'Switch to Chinese',
        'app.enableAutoDetectOrigin': 'Enable origin auto-detect',
        'app.disableAutoDetectOrigin': 'Disable origin auto-detect',
        'station.origin': 'Start',
        'station.destination': 'Destination',
        'station.selectOrigin': 'Select Start',
        'station.selectDestination': 'Select Destination',
        'station.noRecentSearches': 'No recent stations yet',
        'station.noMatches': 'No stations found',
        'toast.geoEnabled': 'Origin auto-detect enabled',
        'toast.geoDisabled': 'Origin auto-detect disabled',
        'toast.defaultDestSet': 'Default destination set',
        'toast.defaultDestCleared': 'Default destination cleared',
        'language.openDialog': 'Open language menu',
        'language.selectTitle': 'Select language',
        'language.zhTW': 'Traditional Chinese',
        'language.en': 'English',
        'time.selectTime': 'Select Time',
        'time.departure': 'Depart',
        'time.arrival': 'Arrive',
        'time.date': 'Date',
        'time.time': 'Time',
        'destinationPrompt.title': 'Where to go?',
        'destinationPrompt.notThese': 'Not these',

        'train.onTime': 'On Time',
        'train.delayMinutes': '+{minutes} min',
        'train.noTrainsAvailable': 'No trains available',

        'error.failedToLoadSchedule': 'Failed to load schedule',
        'error.failedToLoadStations': 'Failed to load stations',
        'common.close': 'Close',
        'common.clear': 'Clear',
        'common.retry': 'Retry',

        'share.arrivalMessage': 'Arrive at {station} by {time}',
        'share.noTrainMessage': 'No more trains available',

        'iosInstall.title': 'Add to Home Screen',
        'iosInstall.subtitle':
            'Add {appName} to your Home Screen for the best experience',
        'iosInstall.step1': 'Tap the Share button at the bottom',
        'iosInstall.step2': 'Choose Add to Home Screen',
        'iosInstall.dismiss': 'Got it',
    },
} as const;

export type TranslationKey = keyof (typeof translations)['zh-TW'];

export const FALLBACK_LANGUAGE: keyof typeof translations = 'zh-TW';
export const STORAGE_LANGUAGE_KEY = 'ontrack_language';
