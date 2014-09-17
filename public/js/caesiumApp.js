(function() {
	var caesiumModule = angular.module('caesiumApp', ['caesiumControllers', 'caesiumDirectives']);

	var tabs = [
		{ url: "/about", description: "About", templateUrl: "templates/About.html", controller: "AboutCtrl" },
		{ url: "/timesheet/", description: "Timesheet", templateUrl: 'templates/Timesheet.html', controller: 'TimesheetCtrl' },
		{ url: "/query", description: "Time Query", templateUrl: 'templates/TimeQuery.html', controller: 'QueryCtrl' }
	];

	var isTabActive = function($location, tab) {
		var path = $location.path();
		return path.substr(0, tab.url.length) == tab.url;
	};

	caesiumModule.run(function($rootScope, $location, $controller) {
		_.each(tabs, function(tab) {
			tab.getController = function($scope) {
				return $controller(tab.controller, { $scope : $scope });
			};
		});

		var _isTabActive = _.partial(isTabActive, $location);

		if(!_.some(tabs, _isTabActive)) {
			$location.path(tabs[0].url);
		}

		$rootScope.isTabActive = _isTabActive;
		$rootScope.globals = {};
		$rootScope.tabs = tabs;
	});
})();
