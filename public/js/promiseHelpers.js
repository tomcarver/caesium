angular.module('promiseHelpers', [])
	.factory('promiseHelpers', function($q) {
		var ns = {};
		ns.newPromise = function(withDeferred) {
			var deferred = $q.defer();
			try {
				withDeferred(deferred);
			} catch (err) {
				deferred.reject(err); 
			}
			return deferred.promise;
		};

		ns.newRequestPromise = function(getRequest) {
			return ns.newPromise(function(deferred) {
				var request = getRequest();

				request.onsuccess = function(ev) { deferred.resolve(request.result); };
				request.onerror = function(ev) { deferred.reject(request.error); };
			});
		};

		ns.newTransactionPromise = function(getTransaction, getResultPromise) {
			return ns.newPromise(function(deferred) {
				var transaction = getTransaction();

				var resultPromise = (getResultPromise || ns.alreadyResolved)(transaction);

				transaction.oncomplete = function(ev) {
					resultPromise.then(deferred.resolve, deferred.reject);
				};
				transaction.onabort = function(ev) { deferred.reject(transaction.error); };
			});
		};

		ns.newMigrationPromise = function(getRequest, migration) {
			return ns.newPromise(function(deferred) {
				var request = getRequest();

				// NB: caller must ensure upgrade callback always called
				request.onupgradeneeded = function(event) {
					var db = request.result;
					ns.newTransactionPromise(
						function() {
							migration(db, request.transaction);
							return request.transaction;
						})
						.then(function() { db.close(); })
						.then(deferred.resolve, deferred.reject);
				};

				request.onblocked = function(ev) { deferred.reject("blocked from upgrading to version " + ev.newVersion); };
				request.onerror = function(ev) { deferred.reject(request.error); };
			});
		};

		ns.newQueryPromise = function(getRequest) {
			return ns.newPromise(function(deferred) {
				var results = [];
				var request = getRequest();

				request.onsuccess = function(ev) {
					var cursor = request.result;
					if (cursor) {
						results.push(cursor.value);
						cursor["continue"]();
					}
					else {
						deferred.resolve(results);
					}
				};
				request.onerror = function(event) {
					deferred.reject(request.error);
				};
			});
		};

		ns.alreadyResolved = function() {
			return ns.newPromise(function(deferred) { deferred.resolve(); });
		};

		return ns;
	});
