angular.module('caesiumApp', ['ngRoute', 'ngAnimate', 'caesiumControllers'])
	.config(['$routeProvider',
		function($routeProvider) {
			$routeProvider
				.when('/tabs/:tabid', {
					templateUrl: 'templates/TabContent.html',
					controller: 'TabContentCtrl'
				})
				.otherwise({
					redirectTo: '/tabs/1'
				});
		}]);
