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

		var entriesForToday = function(db) {
			return promiseHelpers.newQueryPromise(function() {
				var dayNumber = $filter("getDayNumber")(new Date());
				return db
					.transaction("entries", 'readonly')
					.objectStore("entries")
					.index("dayNumber")
					.openCursor(new IDBKeyRange.only(dayNumber));
			});
		};

		var tryGetCurrentEntryForToday = function(db) {
			return entriesForToday(db)
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

		this.getEntriesForToday = function() {
			return store.usingDb(entriesForToday);
		};

		this.getCurrentEntry = function() {
			return store.usingDb(tryGetCurrentEntryForToday);
		};

		this.insertNewTask = function(taskName) {
			return store.usingDb(function(db) {
				var newEntry = $filter("newEntry")(taskName);
				return store.editInTransaction(db, "entries", function(entryStore) {
					entryStore.add(newEntry);
				});
			});
		};

		this.endCurrentTask = function() {
			return store.usingDb(function(db) {
				return tryGetCurrentEntryForToday(db)
					.then(function(entry) {
						if (entry) {
							entry.finishEpochMs = (new Date()).getTime();

							return store.editInTransaction(db, "entries", function(entryStore) {
								entryStore.put(entry);
							});
						}
					});
			});
		};
	});
