export default class Utils {
    constructor() {
        
    }
    static timestampToDate(timestamp) {
        return new Date(timestamp*1000)
    }
    static getRemainingSeconds(date) {
        let diff = date.getTime() - Date.now()
        if(diff <= 0) {
            return 0
        } else {
            return Math.ceil(diff / 1000)
        }
    }

    static currentTimestamp() {
        return Math.round(Date.now() / 1000)
    }

    static secondsToReadableTime(v) {
        if(v <= 0) {
            return 
        }

        let tm = Math.floor(v/60)
        let th = Math.floor(tm/60)
        let d = Math.floor(th/24)

        let h = th%24
        let m = tm%60
        let s = v%60

        return (d > 0 ? `${d.toString().padStart(2,'0')}:` : '') + `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
    }

    static maskAddress(address) {
        return `${address.slice(0,6)}...${address.slice(-4)}`
    }
    static dateAddDay(date, day) {
        let newDate = new Date(date)
        newDate.setDate(newDate.getDate() + Number(day))
        return newDate
    }

    static datetimeToDate(dateObj) {
        let month = dateObj.getUTCMonth() + 1; //months from 1-12
        let day = dateObj.getUTCDate();
        let year = dateObj.getUTCFullYear();

        return `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`;
    }

    static round(v, dp = 2) {
        let d = Math.pow(10, dp)
        return Math.round(v * d)/d;
    }
    static roundToReadable(v, dp=2) {
        return (new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: dp
        })).format(v).replace('$', '')
    }
    static toPercentage(v, dp = 2) {
        return Utils.round(v * 100, dp)
    }

    static async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static isNumber(value) 
    {
        return typeof value === 'number' && isFinite(value);
    }
}

Object.filter = function( obj, predicate) {
    let result = {}, key;

    for (key in obj) {
        if (obj.hasOwnProperty(key) && !predicate(obj[key], key)) {
            result[key] = obj[key];
        }
    }

    return result;
}