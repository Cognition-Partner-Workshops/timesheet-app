import Foundation

extension WorkEntry {
    /// The stored day is UTC midnight; expose the same calendar day in the
    /// device's time zone so pickers and section headers agree with the server.
    var localDate: Date {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let parts = utc.dateComponents([.year, .month, .day], from: date)
        return Calendar.current.date(from: parts) ?? date
    }
}

enum HoursFormat {
    static func number(_ hours: Double) -> String {
        hours.formatted(.number.precision(.fractionLength(0...2)))
    }

    static func short(_ hours: Double) -> String {
        number(hours) + " h"
    }

    static func long(_ hours: Double) -> String {
        let whole = Int(hours)
        let minutes = Int(((hours - Double(whole)) * 60).rounded())
        switch (whole, minutes) {
        case (0, 0): return "0 hours"
        case (_, 0): return whole == 1 ? "1 hour" : "\(whole) hours"
        case (0, _): return "\(minutes) min"
        default: return "\(whole)h \(minutes)m"
        }
    }
}

extension Date {
    var relativeDayLabel: String {
        let calendar = Calendar.current
        if calendar.isDateInToday(self) { return "Today" }
        if calendar.isDateInYesterday(self) { return "Yesterday" }
        if calendar.isDateInTomorrow(self) { return "Tomorrow" }
        let style: Date.FormatStyle = calendar.isDate(self, equalTo: .now, toGranularity: .year)
            ? .dateTime.weekday(.wide).month(.abbreviated).day()
            : .dateTime.month(.abbreviated).day().year()
        return formatted(style)
    }
}

extension DateInterval {
    static func thisWeek(calendar: Calendar = .current, now: Date = .now) -> DateInterval {
        calendar.dateInterval(of: .weekOfYear, for: now) ?? DateInterval(start: now, duration: 0)
    }

    static func thisMonth(calendar: Calendar = .current, now: Date = .now) -> DateInterval {
        calendar.dateInterval(of: .month, for: now) ?? DateInterval(start: now, duration: 0)
    }
}
