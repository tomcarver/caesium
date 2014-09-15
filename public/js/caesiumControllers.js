(function() {
	var controllers = angular.module('caesiumControllers', ['ngRoute', 'caesiumStore', 'caesiumLogic']);

	controllers.controller('PageController', function ($scope, caesiumStore, $location) {
		$scope.globals = {};

		$scope.tabs = [
			{ url: "/timesheet/", description: "Timesheet" }
		];
	});

	var logErrors = function(promise) {
		promise["catch"](function(err) { console.log(err); });
	};

	controllers.controller('CurrentEntryCtrl', function ($scope, $rootScope, caesiumStore, $location) {

		var timeout = null;
		var saveNewDescription = function(newDescription) {
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

		$scope.$watch('currentEntry.description', function(newValue, oldValue) {
			if (newValue != oldValue) {
				// wait until the value hasn't changed for 2 seconds before saving to avoid a DB update for every key press
				window.clearTimeout(timeout);
				timeout = window.setTimeout(saveNewDescription.bind(null, newValue), 2000);
			}
		});

		$scope.startRecording = function() {
			logErrors(caesiumStore.insertNewEntry().then(updateStateForEntry));
		};
	});

	controllers.controller('TimesheetCtrl', function ($scope, $rootScope, caesiumStore, $routeParams, $location, $filter) { /* TODO prevent nav when unsaved */

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
				.reject(function(entry){ return entry.isDeleted; })
				.map(function(entry) { return {"startMins" : entry.editStartMins, "description" : entry.editDescription }; })
				.value();
		}

		var getOriginalTimesheetFromUi = function(timesheet) {
			return _.chain(timesheet)
				.reject(function(entry){ return entry.isUnsaved; })
				.map(function(entry) { return {"startMins" : entry.startMins, "description" : entry.description }; })
				.value();
		};

		$scope.today = new Date();

		$scope.date = $routeParams.day
			? getDateFromDayNumber($routeParams.day)
			: $scope.today;

		$scope.day = getDayNumber($scope.date);

		$scope.refresh = function() {
			$scope.timesheet = null;
			$scope.conflicts = null;
			logErrors(
				caesiumStore.getEntriesForDay($scope.day)
					.then(function(entries) {
						var timesheet = $filter("buildTimesheetFromEntries")(entries, $scope.day);
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

			var original = getOriginalTimesheetFromUi($scope.timesheet);
			var fromUser = getNewTimesheetFromUi($scope.timesheet);

			var newEntries = $filter("buildEntriesFromTimesheet")(fromUser);

			logErrors(
				caesiumStore.replaceEntries($scope.day, newEntries)
					.then($scope.refresh)
					.then(function() { $rootScope.$broadcast("updateCurrentEntry"); }));
		};

		var navigateToDayNum = function(dayNum) { $location.path("/timesheet/" + dayNum); };

		$scope.navigateToPrevDay = _.partial(navigateToDayNum, getOffsetDayNumber($scope.day, -1));
		$scope.navigateToNextDay = _.partial(navigateToDayNum, getOffsetDayNumber($scope.day, 1));
		$scope.navigateToToday = _.partial(navigateToDayNum, getDayNumber($scope.today)); 

		$scope.refresh();
	});
})();
