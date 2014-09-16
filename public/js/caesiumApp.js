(function() {
	var caesiumModule = angular.module('caesiumApp', ['ngRoute', 'ngAnimate', 'caesiumControllers']);

	var tabs = [
		{ url: "/about", description: "About", templateUrl: "About.html", controller: "AboutCtrl" },
		{ url: "/timesheet/", description: "Timesheet", templateUrl: 'Timesheet.html', controller: 'TimesheetCtrl', pattern: '/timesheet/:day?'},
		{ url: "/query", description: "Time Query", templateUrl: 'TimeQuery.html', controller: 'QueryCtrl' }
	];

	caesiumModule
		.config(['$routeProvider',
			function($routeProvider) {

				for (var i = 0; i < tabs.length; i++) {
					var tab = tabs[i];
					$routeProvider
						.when(tab.pattern || tab.url, {
							templateUrl: "templates/" + tab.templateUrl,
							controller: tab.controller
						}); 
				}

				$routeProvider.otherwise({ redirectTo: tabs[0].url });
			}]);

	caesiumModule.run(function($rootScope, $location) {
		$rootScope.location = $location;
		$rootScope.globals = {};
		$rootScope.tabs = tabs;
	});
})();
