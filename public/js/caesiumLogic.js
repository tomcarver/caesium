var caesiumLogic = angular.module('caesiumLogic', []);

caesiumLogic.filter({
	"getDayNumber": function() {
		return function(date) {
			// all we need to do is disambiguate days so don't worry about efficient packing - it's fine to leave gaps.
			// also NB: month is zero-based but we're consistent with it so it's fine.
			return date.getDate() + (date.getMonth() * 31) + (date.getFullYear() * 31 * 12);
		};
	},
	"getUserDateFromDayNumber": function() {
		return function(dayNumber) {
			var withinYear = dayNumber % (31 * 12);
			var year = (dayNumber - withinYear) / (31*12);
			var day = withinYear % 31;
			var month = (withinYear - day) / 31;
			return "" + day + "/" + (month + 1) + "/" + year; // NB: months are zero-based
			// TODO localise
		};
	},
	"getUserTimeFromMsCount": function() {
		return function(msCount) {
			if (msCount) {
				var date = new Date(msCount);
				return "" + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
			}
			// TODO localise
		};
	},
	"newEntry": function($filter) {
		var getDayNumber = $filter("getDayNumber");
		return function(description) {
			var now = new Date();

			return { "dayNumber" : getDayNumber(now), "startEpochMs" : now.getTime(), "description" : description };
		};
	}
});
