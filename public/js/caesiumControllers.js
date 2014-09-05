var controllers = angular.module('caesiumControllers', ['ngRoute', 'caesiumStore', 'caesiumLogic']);

controllers.controller('CurrentEntryCtrl', function ($scope, caesiumStore, $location) {

	caesiumStore.getCurrentEntry()
		.then(function(entry) {
			if (!entry) {
				$location.path("/notworking");
				return;
			}
			$scope.status = "Loaded";
			$scope.currentEntry = entry;
			$scope.title = entry;
		}, function(err) {
			console.log(err);
		});

	caesiumStore.getEntriesForToday()
		.then(function(entries) {
			$scope.previousEntries = entries;
		});

	$scope.orderProp = "finishEpochMs";

	$scope.stopWorking = function() {
		caesiumStore.endCurrentTask()
			.then(function() {
				$location.path("/notworking");
			}, function(err) {
				console.log(err);
			});
	};
});

controllers.controller('NotWorkingCtrl', function ($scope, caesiumStore, $routeParams, $location) {

	$scope.title = "Not working";

	caesiumStore.getCurrentEntry()
		.then(function(entry) {
			if (entry) {
				$location.path("/working");
				return;
			}
		}, function(err) {
			console.log(err);
		});

	$scope.startWorking = function() {
		caesiumStore.insertNewTask("New Task")
			.then(function() {
				$location.path("/working");
			}, function(err) {
				console.log(err);
			});
	};
});
