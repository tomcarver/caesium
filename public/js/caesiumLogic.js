(function() {
	var caesiumLogic = angular.module('caesiumLogic', []);

	var noTaskDescription = "[no task recorded]";

	var getDayNumber = function(date) {
		// all we need to do is disambiguate days so don't worry about efficient packing - it's fine to leave gaps.
		// also NB: month is zero-based but we're consistent with it so it's fine.
		return date.getDate() + (date.getMonth() * 31) + (date.getFullYear() * 31 * 12);
	};

	var getOffsetDayNumber = function(dayNum, offset) {
		var date = getDateFromDayNumber(dayNum);
		date.setDate(date.getDate() + offset);
		return getDayNumber(date);
	};

	var getDateFromDayNumber = function(dayNumber) {
		var withinYear = dayNumber % (31 * 12);
		var year = (dayNumber - withinYear) / (31*12);
		var day = ((withinYear - 1) % 31) + 1; // the 0th Sept is actually the 31st Aug
		var month = (withinYear - day) / 31;

		var date = new Date();
		date.setFullYear(year, month, day);  // auto-corrects invalid dates
		date.setHours(0,0,0,0); // zero out current time
		return date;
	};

	var getOffsetMinsFromDate = function(date) {
		if (date) {
			return (date.getHours() * 60) + date.getMinutes();
		}
	};

	var newEntry = function($filter, description, dayNumber, startMins, finishMins) {
		var now = new Date();

		if (!description)
			description = "New Task: " + $filter("date")(now, "HH:mm");

		if (!dayNumber) {
			dayNumber = getDayNumber(now);
			startMins = getOffsetMinsFromDate(now);
		}

		return { "dayNumber" : dayNumber, "startMins" : startMins, "finishMins" : finishMins, "description" : description };
	};

	var timesheetToHash = function(timesheet) {
		return _.chain(timesheet)
			.map(function(entry) { return [entry.startMins, entry.description]; })
			.object()
			.value();
	};

	var formatDescription = function(descripton) {
		return _.isUndefined(descripton) ? "deleted" : "'" + descripton + "'";
	};

	// currently uses startTime as a primary key, i.e. change of start time is an insertion/deletion pair.
	// NB: not currently in use
	var mergeTimesheets = function(original, fromUser, fromDb) {

		var original_hash = timesheetToHash(original);
		var fromUser_hash = timesheetToHash(fromUser);
		var fromDb_hash = timesheetToHash(fromDb);

		var startTimes = _.chain(original.concat(fromUser, fromDb))
			.map(function(entry) { return entry.startMins; })
			.uniq()
			.sortBy(function(time) { return time; })
			.value();

		var newTimesheet = [];
		var conflicts = [];

		for (var i = 0; i < startTimes; i++) {
			var startTime = startTimes[i];
			var original_desc = original_hash[startTime];
			var fromUser_desc = fromUser_hash[startTime];
			var fromDb_desc = fromDb_hash[startTime];

			var descriptionHasChanged = (original_desc !== fromUser_desc) && (fromUser_desc !== fromDb_desc);
			var descriptionToUse = descriptionHasChanged ? fromUser_desc : fromDb_desc;

			if (!_.isUndefined(descriptionToUse)) {
				newTimesheet.push({ "startMins": startTime, "description": descriptionToUse });
			}

			if (descriptionHasChanged && (original_desc !== fromDb_desc)) {
				conflicts.push({
					"startMins" : startTime,
					"message": "Task was " + formatDescription(fromDb_desc) + ", updated to " + formatDescription(fromUser_desc)
				});
			}
		}

		return { result: newTimesheet, conflicts: conflicts };
	};

	var buildTimesheetFromEntries = function(entries, day) {

		entries = _.chain(entries)
			.filter(function(entry) { return entry.finishMins !== entry.startMins; })
			.sortBy(function(entry) { return entry.startMins; })
			.value();

		var cumulativeMins = 0;
		var timesheetEntries = [];

		for (var i = 0; i < entries.length; i++) {
			var entry = entries[i];

			if (typeof cumulativeMins == 'undefined') {
				console.log("overlap - after open-ended task, found task beginning at " + entry.startMins + " mins");
			}
			else {
				if (entry.startMins < cumulativeMins) {
					console.log("overlap not allowed (" + cumulativeMins + " -> " + entry.startMins + ")");
				}
				else {
					if (entry.startMins > cumulativeMins) {
						timesheetEntries.push({ "startMins": cumulativeMins, "description": noTaskDescription});
					}
				}	
			}

			timesheetEntries.push({ "startMins": entry.startMins, "description": entry.description });
			cumulativeMins = entry.finishMins;
		}

		if (typeof cumulativeMins != 'undefined') {
			timesheetEntries.push({ "startMins": cumulativeMins, "description": noTaskDescription});
		}

		return timesheetEntries;
	};

	var buildEntriesFromTimesheet = function(timesheet) {
		var entries = [];
		var lastEntry = null;

		for (var i = 0; i < timesheet.length; i++) {
			var entry = timesheet[i];
			if (lastEntry)
				lastEntry.finishMins = entry.startMins;

			if (entry.description == noTaskDescription) {
				lastEntry = null;
			}
			else {
				lastEntry = { "startMins": entry.startMins, "description": entry.description };
				entries.push(lastEntry);
			}
		}

		return entries;
	};

	caesiumLogic.filter({
		"getDayNumber": function() { return getDayNumber },
		"getOffsetDayNumber": function() { return getOffsetDayNumber },
		"getDateFromDayNumber": function() { return getDateFromDayNumber; },
		"getOffsetMinsFromDate": function() { return getOffsetMinsFromDate; },
		"newEntry": function($filter) { return newEntry.bind(null, $filter); },
		"mergeTimesheets": function() { return mergeTimesheets; },
		"buildTimesheetFromEntries": function() { return buildTimesheetFromEntries; },
		"buildEntriesFromTimesheet": function() { return buildEntriesFromTimesheet; }
	});

	caesiumLogic.directive('time', function($filter) {
		return {
		    restrict: 'A', // specify directive by attribute only
		    require: 'ngModel',
		    link: function(scope, element, attr, ngModel) {
				var timePattern = /^\s*(\d{1,2})\s*(?:\:\s*(\d{2}))?\s*$/;
		        
				ngModel.$parsers.push(function (text) {
					var result = timePattern.exec(text);
					element.toggleClass('invalid', !result);
					if (result) {
						var mins = (result[2] || 0) * 1;
						return (result[1] * 60) + mins;
					}
				});
				ngModel.$formatters.push(function (mins) {
					if (typeof mins != 'undefined') {
						return $filter("date")(new Date(mins * 60 * 1000), "HH:mm");
					}
				});
		    }
		};
	});
})();
