const canvas = require('canvas-wrapper');
const asyncLib = require('async');

module.exports = (course, stepCallback) => {
    /**
     * Retrieves the assignment groups from Canvas
     * @param {callback} - waterfall callback sends the parameters to the next function 
     * @returns {object array} - the assignment groups array
     */
    function getGroups(getGroupsCallback) {
        canvas.get(`/api/v1/courses/${course.info.canvasOU}/assignment_groups`, (err, groups) => {
            if (err) {
                course.error(err);
                stepCallback(null, course);
                return;
            }
            if (groups.length === 0) {
                course.warning(`There are no assignment groups in this course. Skipping this child module.`);
                stepCallback(null, course);
                return;
            }
            getGroupsCallback(null, groups);
        });
    }

    /**
     * Renames the assignment groups in Canvas to be 'Week xx' if they are currently 'Lesson xx, Lxx, Wxx'
     * @param {object array} - the assignment groups array 
     * @param {callback} - waterfall callback sends the parameters to the next function 
     * @returns {object array} - the assignment groups array
     */
    function renameGroups(groups, renameCallback) {
        if (groups.length !== 0) {
            asyncLib.eachSeries(groups, (group, callback) => {
                if (/(Lesson|L|W)\s*(\d*(\D|$))/i.test(group.name)) {
                    var oldName = group.name;
                    var name = group.name.replace(/(Lesson|L|W)\s*/, 'Week ');
                    canvas.put(`/api/v1/courses/${course.info.canvasOU}/assignment_groups/${group.id}`, {
                        'name': name,
                    }, (putErr) => {
                        if (putErr) {
                            callback(err); // Do the error handling in the eachSeries callback
                            return;
                        }
                        course.log('Renamed Assignment Group', {
                            'Old Title': oldName,
                            'New Title': name,
                            'ID': group.id,
                        });
                    });
                }
                callback();
            }, (err) => {
                if (err) {
                    course.error(err); // If there is an error renaming, continue the program still to delete the empty assignment groups
                }
                renameCallback(null, groups);
            });
        } else {
            renameCallback(null, groups);
        }
    }

    /**
     * Determines if the 'Assignments' and 'Imported Assignments' groups from Canvas are empty or not
     * @param {object array} - the assignment groups array
     * @param {callback} - waterfall callback sends the parameters to the next function
     * @returns {various variables} - see the callback or deleteAssignmentsGroup function header
     */
    function checkGroups(groups, deleteCallback) {
        var assignmentsId = '';
        var importedAssignmentsId = '';

        // Find the 'Assignments' and 'Imported Assignments' assignment group IDs
        groups.forEach(group => {
            if (group.name === 'Assignments') {
                assignmentsId = group.id;
            }
            if (group.name === 'Imported Assignments') {
                importedAssignmentsId = group.id;
            }
        });

        // Get all of the assignments from Canvas
        canvas.get(`/api/v1/courses/${course.info.canvasOU}/assignments`, (err, assignments) => {
            if (err) {
                course.error(err);
                stepCallback(null, course);
                return;
            }

            // Check if there are any assignments in either of the groups to be deleted
            var deleteAssignments = assignments.find(assignment => assignment.assignment_group_id === assignmentsId);
            var deleteImportedAssignments = false;

            // Change importedAssignmentGroup to true if an assignment belongs in that assignment group
            groups.forEach(group => {
                assignments.forEach(assignment => {
                    if (assignment.assignment_group_id === group.id) {
                        deleteImportedAssignments = true;
                    }
                });
            });

            /* Send all of these variables to the delete functions */
            deleteCallback(null, deleteAssignments, deleteImportedAssignments, assignmentsId, importedAssignmentsId)
        });
    }

    /**
     * Deletes the 'Assignments' group from Canvas if it is empty
     * @param {object} - deleteAssignments: defined or undefined, determines whether or not 'Assignments' should be deleted
     * @param {object} - deleteImportedAssignments: true/false, whether or not 'Imported Assignments' should be deleted
     * @param {integer} - assignmentsId: the 'Assignments' assignment group ID
     * @param {integer} - importedAssignmentsId: the 'Imported Assignments' assignment group ID
     * @param {callback} - waterfall callback sends the parameters to the next function
     * @returns {various variables} - see the callback or deleteAssignmentsGroup function header
     */
    function deleteAssignmentsGroup(deleteAssignments, deleteImportedAssignments, assignmentsId, importedAssignmentsId, deleteCallback) {
        // If there are no assignments in the 'Assignments' assignment group, then delete the group
        if (deleteAssignments === undefined) {
            canvas.delete(`/api/v1/courses/${course.info.canvasOU}/assignment_groups/${assignmentsId}`, (err) => {
                if (err) {
                    course.error(err); // If there is an error, still try to delete the other assignment group
                } else {
                    course.log(`Deleted Assignment Group`, {
                        'Assignment Group Title': 'Assignments',
                        'ID': assignmentsId,
                    });
                }
                deleteCallback(null, deleteImportedAssignments, importedAssignmentsId);
            });
        } else {
            deleteCallback(null, deleteImportedAssignments, importedAssignmentsId);
        }
    }

    /**
     * Deletes the 'Imported Assignments' group from Canvas if it is empty
     * @param {object} - deleteImportedAssignments: true/false, whether or not 'Imported Assignments' should be deleted
     * @param {integer} - importedAssignmentsId: the 'Imported Assignments' assignment group ID
     * @param {callback} - waterfall callback sends the parameters to the next function
     * @returns {object array} - see the callback
     */
    function deleteImportedGroup(deleteImportedAssignments, importedAssignmentsId, deleteCallback) {
        // If there are no assignments in the 'Imported Assignments' assignment group, then delete the group
        if (deleteImportedAssignments !== true) {
            canvas.delete(`/api/v1/courses/${course.info.canvasOU}/assignment_groups/${importedAssignmentsId}`, (err) => {
                if (err) {
                    course.error(err);
                    stepCallback(null, course);
                    return;
                }
                course.log(`Deleted Assignment Group`, {
                    'Assignment Group Title': 'Imported Assignments',
                    'ID': importedAssignmentsId,
                });
                deleteCallback(null);
            });
        } else {
            deleteCallback(null);
        }
    }

    // Functions to run in async waterfall
    var myFunctions = [
        getGroups,
        renameGroups,
        checkGroups,
        deleteAssignmentsGroup,
        deleteImportedGroup,
    ];

    // Run each function one at a time, passing their results to the next function
    asyncLib.waterfall(myFunctions, waterfallErr => {
        if (waterfallErr) {
            course.error(waterfallErr);
        }
        stepCallback(null, course);
    });
};