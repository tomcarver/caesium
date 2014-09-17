(function() {
	var caesiumLogic = angular.module('caesiumLogic', []);

	var noTaskDescription = "[no task recorded]";
	var timePattern = /^\s*(\d{1,2})\s*(?:\:\s*(\d{2}))?\s*$/;
	var datePattern = /^\s*(\d{4})\s*\-\s*(\d{2})\s*\-\s*(\d{2})\s*$/;

	caesiumLogic.constant("timePattern", timePattern);
	caesiumLogic.constant("datePattern", datePattern);

	var getDayNumber = function(date) {
		// also NB: month from date object is zero-based, convert to one-based
		return getDayNumberFromComponents(date.getDate(), date.getMonth() + 1, date.getFullYear());
	};

	var getDayNumberFromComponents = function(day, month, year) {
		// all we need to do is disambiguate days so don't worry about efficient packing - it's fine to leave gaps.
		// convert month back to zero-based (from more intuitive one-based).
		return day + ((month - 1) * 31) + (year * 31 * 12);
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

	var formatDuration = function($filter, mins) {
		if (!_.isUndefined(mins)) {
			var withinDay = mins % (60 * 8);
			var days = (mins - withinDay) / (60 * 8);
			var justMins = (withinDay % 60);
			var hours = (withinDay - justMins) / 60;

			return (days ? days + "d, " : "")
				+ (hours ? hours + "h, " : "")
				+ justMins + "m";
		}
	}

	var formatMins = function($filter, mins) {
		if (!_.isUndefined(mins)) {
			return $filter("date")(new Date(0,0,0,0, mins), "HH:mm");
		}
	}

	var formatDayNumber = function ($filter, dayNumber) {
		if (!_.isUndefined(dayNumber)) {
			var date = getDateFromDayNumber(dayNumber);
			return $filter("date")(date, "yyyy-MM-dd");
		}
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

			if (_.isUndefined(cumulativeMins)) {
				console.log("overlap - after open-ended task, found task beginning at " + entry.startMins + " mins");
			}
			else {
				if (entry.startMins < cumulativeMins) {
					console.log("overlap not allowed (" + cumulativeMins + " -> " + entry.startMins + ")");
				}
				else {
					if (entry.startMins > cumulativeMins && cumulativeMins != 0) {
						timesheetEntries.push({ "startMins": cumulativeMins, "description": noTaskDescription});
					}
				}	
			}

			timesheetEntries.push({ "startMins": entry.startMins, "description": entry.description });
			cumulativeMins = entry.finishMins;
		}

		if (!_.isUndefined(cumulativeMins) && cumulativeMins != 0) {
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

	// NB: not pure - depends on current date/time
	var sumDurations = function(entries) {
		var now = new Date();
		var todayNumber = getDayNumber(now);
		var nowMins = getOffsetMinsFromDate(now);

 		return _.reduce(entries, function(cumulativeDuration, entry) {
			// special case: if the entry day is today, open-ended tasks end *now* not the end of the day.

			var finishMins = _.isUndefined(entry.finishMins)
				? (entry.dayNumber == todayNumber ? nowMins : (60*24))
				: entry.finishMins;

			var thisDuration = finishMins - entry.startMins;
			return cumulativeDuration + thisDuration;
		}, 0)
	};

	var sumGroupDurations = function(entries) {
 		return _.reduce(entries, function(mins, entry) { return mins + entry.duration; }, 0);
	};

	caesiumLogic.filter({
		"getDayNumber": function() { return getDayNumber; },
		"getDayNumberFromComponents": function() { return getDayNumberFromComponents; },
		"getOffsetDayNumber": function() { return getOffsetDayNumber; },
		"getDateFromDayNumber": function() { return getDateFromDayNumber; },
		"getOffsetMinsFromDate": function() { return getOffsetMinsFromDate; },
		"newEntry": function($filter) { return newEntry.bind(null, $filter); },
		"mergeTimesheets": function() { return mergeTimesheets; },
		"buildTimesheetFromEntries": function() { return buildTimesheetFromEntries; },
		"buildEntriesFromTimesheet": function() { return buildEntriesFromTimesheet; },
		"formatDuration": function($filter) { return formatDuration.bind(null, $filter); },
		"formatMins": function($filter) { return formatMins.bind(null, $filter); },
		"formatDayNumber": function($filter) { return formatDayNumber.bind(null, $filter); },
		"sumDurations": function() { return sumDurations; },
		"sumGroupDurations": function() { return sumGroupDurations; }
	});
})();
