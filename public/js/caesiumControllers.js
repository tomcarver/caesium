(function() {
	var controllers = angular.module('caesiumControllers', ['ngRoute', 'caesiumStore', 'caesiumLogic']);

	var logErrors = function(promise) {
		promise["catch"](function(err) { console.log(err); });
	};

	controllers.controller('CurrentEntryCtrl', function ($scope, $rootScope, caesiumStore, $location) {

		var timeout = null;
		var saveNewDescription = function() {
			var newDescription = $scope.currentEntry.description;

			logErrors(caesiumStore
				.updateCurrentEntry(newDescription)
				.then(function() {
					$scope.globals.status = newDescription;
				}));
		};

		var updateStateForEntry = function(entry) {
			window.clearTimeout(timeout);
			$scope.currentEntry = entry ? {description: entry.description} : null;
			$scope.globals.status = entry ? entry.description : "Not recording";

			logErrors(caesiumStore.getRecentTaskDescriptions()
				.then(function(descriptions) {
					$scope.recentDescriptions = descriptions;
				}));
		};

		$scope.globals.status = "Loading...";

		$rootScope.$on("updateCurrentEntry", function() {
			logErrors(caesiumStore.getCurrentEntry().then(updateStateForEntry));
		});

		$rootScope.$broadcast("updateCurrentEntry");

		$scope.stopRecording = function() {
			logErrors(caesiumStore.endCurrentEntry().then(function() { updateStateForEntry(null); }));
		};

		$scope.newEntry = function() {
			logErrors(caesiumStore.endCurrentEntry()
				.then(function() { return caesiumStore.insertNewEntry(); })
				.then(updateStateForEntry));
		};

		$scope.descriptionChanged = function() {
			// wait until the value hasn't changed for 2 seconds before saving to avoid a DB update for every key press
			window.clearTimeout(timeout);
			timeout = window.setTimeout(saveNewDescription, 2000);
		};

		$scope.startRecording = function() {
			logErrors(caesiumStore.insertNewEntry().then(updateStateForEntry));
		};
	});

	controllers.controller('TimesheetCtrl', function ($scope, $rootScope, caesiumStore, $filter, $window) {

		var getDayNumber = $filter("getDayNumber");
		var getDateFromDayNumber = $filter("getDateFromDayNumber");
		var getOffsetDayNumber = $filter("getOffsetDayNumber");
		var newEntry = $filter("newEntry");
		var mergeTimesheets = $filter("mergeTimesheets");

		var isEntryChanged = function(entry) {
			return (entry.editStartMins != entry.startMins)
				|| (entry.editDescription != entry.description)
				|| (entry.isUnsaved != entry.isDeleted);
		};

		var prepareEntryForUi = function(entry) {
			entry.editStartMins = entry.startMins;
			entry.editDescription = entry.description;
			entry.isChanged = isEntryChanged.bind(null, entry);
		};

		var getNewTimesheetFromUi = function(timesheet) {
			return _.chain(timesheet)
				.reject("isDeleted")
				.map(function(entry) { return {"startMins" : entry.editStartMins, "description" : entry.editDescription }; })
				.sortBy("startMins")
				.value();
		}

		var getOriginalTimesheetFromUi = function(timesheet) {
			return _.chain(timesheet)
				.reject("isUnsaved")
				.map(function(entry) { return {"startMins" : entry.startMins, "description" : entry.description }; })
				.sortBy("startMins")
				.value();
		};

		$scope.today = new Date();
		
		var navigateToDayNum = function(dayNum) {
			$scope.query = { day: dayNum };
			$scope.date = getDateFromDayNumber(dayNum);
			$scope.refresh();
		};

		$scope.refresh = function() {
			$scope.today = new Date();
			$scope.timesheet = null;

			logErrors(
				caesiumStore.getEntriesForDay($scope.query.day)
					.then(function(entries) {
						var timesheet = $filter("buildTimesheetFromEntries")(entries, $scope.query.day);
						_.each(timesheet, prepareEntryForUi);
						$scope.timesheet = timesheet;
					}));
		};

		$scope.newEntry = function() {
			var entry = newEntry();
			entry.isUnsaved = true;
			$scope.timesheet.push(entry);
			prepareEntryForUi(entry);
		};

		$scope.unsavedChanges = function() {
			return $scope.timesheet && _.some($scope.timesheet, isEntryChanged);
		};

		$scope.deleteEntry = function(entry) {
			entry.isDeleted = true;
		};

		$scope.save = function() {
			var fromUser = getNewTimesheetFromUi($scope.timesheet);

			var newEntries = $filter("buildEntriesFromTimesheet")(fromUser);

			logErrors(
				caesiumStore.replaceEntries($scope.query.day, newEntries)
					.then($scope.refresh)
					.then(function() { $rootScope.$broadcast("updateCurrentEntry"); }));
		};

		$scope.navigateToPrevDay = function() { navigateToDayNum(getOffsetDayNumber($scope.query.day, -1)); };
		$scope.navigateToNextDay = function() { navigateToDayNum(getOffsetDayNumber($scope.query.day, 1)); };
		$scope.navigateToToday = function() { navigateToDayNum(getDayNumber($scope.today)); };
		$scope.navigateToCalendar = function() { if ($scope.query.day) { navigateToDayNum($scope.query.day); } };

		$window.onbeforeunload = function() {
			if ($scope.unsavedChanges())
				return "Unsaved changes to your timesheet will be lost"; 
		};

		navigateToDayNum(getDayNumber($scope.today));
	});

	controllers.controller('QueryCtrl', function ($scope, caesiumStore, $filter) {

		var getDayNumber = $filter("getDayNumber");
		var sumDurations = $filter("sumDurations");
		var formatDayNumber = $filter('formatDayNumber');
		var csvEscapeRow = $filter("csvEscapeRow");

		var todayNumber = getDayNumber(new Date());

		$scope.query = {
			from: todayNumber,
			to: todayNumber,
			text: "",
			splitByTask: true,
			splitByDay: false
		};

		$scope.sortOrder = ['-dayNumber', 'description', 'duration'];

		var timeout = null;

		$scope.refresh = function() {
			$scope.entryGroups = [{ description: "Loading...", duration: 0 }];
			// don't query on every keypress
			window.clearTimeout(timeout);
			timeout = window.setTimeout(queryData, 200);
		};

		var queryData = function() {
			logErrors(
				caesiumStore.getEntriesForDayRange($scope.query.from, $scope.query.to)
					.then(updateData));
		};

		var updateData = function(entries) {
			var filterText = ($scope.query.text || "").toLowerCase();

			var result = _.chain(entries)
				.reject(function(entry) {
					return filterText && ((entry.description || "").toLowerCase().indexOf(filterText) == -1);
				})
				.groupBy(function(entry) {
					return ($scope.query.splitByTask ? entry.description : "") + "<>" + ($scope.query.splitByDay ? entry.dayNumber : "")
				})
				.map(function(entriesInGroup, key) {
					var firstEntry = entriesInGroup[0];
					return {
						dayNumber: $scope.query.splitByDay && firstEntry.dayNumber,
						description: $scope.query.splitByTask && firstEntry.description,
						duration: sumDurations(entriesInGroup)
					};
				})
				.value();

			$scope.entryGroups = result.length > 0
				? result
				: [{ description: "No entries found", duration: 0 }];
		};

		$scope.getCsv = function() {
			var d = $scope.query.splitByDay;
			var t = $scope.query.splitByTask;

			var csv = (d ? "Day," : "") + (t ? "Task," : "") + "No. Minutes" + "\r\n"
				+ _.map($scope.entryGroups, function(e)
				{
					var values = [];
					if ($scope.query.splitByDay) values.push(formatDayNumber(e.dayNumber));
					if ($scope.query.splitByTask) values.push(e.description);
					values.push(e.duration);

					return csvEscapeRow(values);
				}).join("");

			window.location = "data:application/octet-stream," + encodeURIComponent(csv);
		};

		$scope.refresh();
	});

	controllers.controller('AboutCtrl', function ($scope) { });
})();
