var caesiumStore = angular.module('caesiumStore', ['promiseHelpers', 'caesiumLogic', 'store']);

caesiumStore
	.config(function(storeProvider) {
		storeProvider
			.dbName('caesium')
			.migrations([
				function(db, transaction) {
					var entryStore = db.createObjectStore("entries", { keyPath: 'id', autoIncrement: true });

					entryStore.createIndex("dayNumber", "dayNumber", { unique: false });
					entryStore.createIndex("taskId", "taskId", { unique: false });
				}
			]);
	});

caesiumStore
	.service('caesiumStore', function($q, store, promiseHelpers, $filter) {

		this.getEntriesForToday = function() {
			return store
				.singleOperation(function(db) {
					return promiseHelpers.newQueryPromise(function() {
						var dayNumber = $filter("getDayNumber")(new Date());
						return db
							.transaction("entries", 'readonly')
							.objectStore("entries")
							.index("dayNumber")
							.openCursor(new IDBKeyRange.only(dayNumber));
					});
				});
		};

		this.getCurrentEntry = function() {
			return this.getEntriesForToday()
				.then(function(todayEntries) {
					var len = todayEntries.length;
					for (var i = 0; i < len; i++) {
						var entry = todayEntries[i];

						if (!entry.finishEpochMs)
							return entry;
					}
					return null;
				});
		};

		this.insertNewTask = function(taskName) {
			return store.singleOperation(function(db) {
				return promiseHelpers.newTransactionPromise(function() {
					var transaction = db.transaction("entries", "readwrite");
					var entryStore = transaction.objectStore("entries");
					entryStore.add($filter("newEntry")(taskName));

					return transaction;
				});
			});
		};

		this.endCurrentTask = function() {
			return this.getCurrentEntry()
				.then(function(entry) {
					if (entry) {
						entry.finishEpochMs = (new Date()).getTime();
						return store.singleOperation(function(db) {
							return promiseHelpers.newTransactionPromise(function() {
								var transaction = db.transaction("entries", "readwrite");
								transaction.objectStore("entries").put(entry);
								return transaction;
							});
						});
					}
				});
		};
	});
