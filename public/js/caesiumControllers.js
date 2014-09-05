var controllers = angular.module('caesiumControllers', ['ngRoute', 'caesiumStore', 'caesiumLogic']);

controllers.controller('PageController', function ($scope, caesiumStore, $location) {
	$scope.globals = {};
});

controllers.controller('CurrentEntryCtrl', function ($scope, caesiumStore, $location) {

	var logErrors = function(promise) {
		promise["catch"](function(err) { console.log(err); });
	};

	var updateStateForEntry = function(entry) {
		console.log(entry);
		$scope.currentEntry = entry;
		$scope.status = entry ? entry.description : "Not recording";
//			$location.path("/notworking");
	};

	$scope.status = "Loading...";

	logErrors(caesiumStore.getCurrentEntry().then(updateStateForEntry));

	caesiumStore.getEntriesForToday()
		.then(function(entries) {
			$scope.previousEntries = entries;
		});

	$scope.orderProp = "finishEpochMs";

	$scope.stopWorking = function() {
		logErrors(caesiumStore.endCurrentTask().then(function() { updateStateForEntry(null); }));
	};

	$scope.startWorking = function() {
		logErrors(caesiumStore.insertNewTask("New Task").then(updateStateForEntry));
	};
});

controllers.controller('TabContentCtrl', function ($scope, caesiumStore, $routeParams, $location) {

	$scope.globals.tabid = $routeParams.tabid;
});
