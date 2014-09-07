var caesiumModule = angular.module('caesiumApp', ['ngRoute', 'ngAnimate', 'caesiumControllers']);

caesiumModule
	.config(['$routeProvider',
		function($routeProvider) {
			$routeProvider
				.when('/timesheet', {
					templateUrl: 'templates/Timesheet.html',
					controller: 'TimesheetCtrl'
				})
				.otherwise({
					redirectTo: '/timesheet'
				});
		}]);

caesiumModule.run(function($rootScope, $location) {
    $rootScope.location = $location;
});
