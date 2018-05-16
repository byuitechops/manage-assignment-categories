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
            getGroupsCallback(null, groups);
        });
    }

    /**
     * Renames the assignment groups in Canvas to be 'Week xx' if they are currently 'Lesson xx, Lxx, Wxx'
     * @param {callback} - waterfall callback sends the parameters to the next function 
     * @param {object array} - the assignment groups array 
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
                            course.error(putErr);
                            stepCallback(null, course);
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
            });
        }
        renameCallback(null, groups);
    }

    /**
     * Deletes the 'Assignments' and 'Imported Assignments' groups from Canvas if they are empty
     * @param {callback} - waterfall callback sends the parameters to the next function
     * @param {object array} - the assignment groups array
     * @returns {object array} - the assignment groups array
     */
    function deleteGroups(groups, deleteCallback) {
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
            var assignmentGroup = assignments.find(assignment => assignment.assignment_group_id === assignmentsId);
            var importedAssignmentGroup = false;

            // Change importedAssignmentGroup to true if an assignment belongs in that assignment group
            groups.forEach(group => {
                assignments.forEach(assignment => {
                    if (assignment.assignment_group_id === group.id) {
                        importedAssignmentGroup = true;
                    }
                });
            });

            // If there are no assignments in the 'Assignments' assignment group, then delete the group
            if (assignmentGroup === undefined) {
                canvas.delete(`/api/v1/courses/${course.info.canvasOU}/assignment_groups/${assignmentsId}`, (err) => {
                    if (err) {
                        course.error(err);
                        stepCallback(null, course);
                        return;
                    }
                    course.log(`Deleted Assignment Group`, {
                        'Title': 'Assignments',
                        'ID': assignmentsId,
                    });
                });
            }

            // If there are no assignments in the 'Imported Assignments' assignment group, then delete the group
            if (importedAssignmentGroup !== true) {
                canvas.delete(`/api/v1/courses/${course.info.canvasOU}/assignment_groups/${importedAssignmentsId}`, (err) => {
                    if (err) {
                        course.error(err);
                        stepCallback(null, course);
                        return;
                    }
                    course.log(`Deleted Assignment Group`, {
                        'Title': 'Imported Assignments',
                        'ID': importedAssignmentsId,
                    });
                });
            }
            deleteCallback(null);
        });
    }

    // Functions to run in async waterfall
    var myFunctions = [
        getGroups,
        renameGroups,
        deleteGroups,
    ];

    // Run each function one at a time, passing their results to the next function
    asyncLib.waterfall(myFunctions, waterfallErr => {
        if (waterfallErr) {
            course.error(waterfallErr);
        }
        stepCallback(null, course);
    });
};