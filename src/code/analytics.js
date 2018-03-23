import { GameAnalytics, EGAProgressionStatus } from 'gameanalytics'
import gakeys from './gakeys'

export function initAnalytics() {
    if (gakeys.enable) {
        GameAnalytics.setEnabledInfoLog(true);
        GameAnalytics.initialize(gakeys.game, gakeys.secret);
        GameAnalytics.configureBuild('0.1')
    }
}
export function sendDesignEvent(event, value) {
    if (gakeys.enable) {
        GameAnalytics.addDesignEvent(event, value);
    }
}

export function sendCompleteEvent(level, score) {
    if (gakeys.enable) {
        GameAnalytcis.addProgressionEvent(EGAProgressionStatus.Complete,level, '', '', score)
    }
}

export function sendLoseEvent(level, score) {
    if (gakeys.enable) {
        GameAnalytcis.addProgressionEvent(EGAProgressionStatus.Fail, level, '', '', score)
    }
}

export function sendStartEvent(level) {
    if (gakeys.enable) {
        GameAnalytcis.addProgressionEvent(EGAProgressionStatus.start, level)
    }
}