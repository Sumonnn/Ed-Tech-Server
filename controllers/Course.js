const Course = require("../models/courseModel");
const Category = require("../models/categoryModel");
const Section = require("../models/sectionModel");
const SubSection = require("../models/subSectionModel");
const User = require("../models/userModel");
const CourseProgress = require("../models/courseProgressModel");
const { uploadImageToCloudinary } = require("../utils/imageUploader");
const { convertSecondsToDuration } = require("../utils/secToDuration");

require("dotenv").config();


//createCourse handler function
exports.createCourse = async (req, res) => {
    try {
        //fetch data 
        let { courseName, courseDescription, whatYouWillLearn, price, tag: _tag, category, status, instructions: _instructions } = req.body;

        //get thumbnail
        const thumbnail = req.files.thumbnailImage;

        // Convert the tag and instructions from stringified Array to Array

        let tag, instructions;

        try {
            // Check if _tag is not empty or undefined
            if (_tag && _tag.trim() !== "") {
                tag = JSON.parse(_tag);
            } else {
                throw new Error("Empty or undefined value for 'tag'.");
            }
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: `Error parsing 'tag'. ${error.message}`,
            });
        }

        try {
            // Check if _instructions is not empty or undefined
            // if (_instructions && _instructions.trim() !== "") {
            instructions = JSON.parse(_instructions);
            // } else {
            //     throw new Error("Empty or undefined value for 'instructions'.");
            // }
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: `Error parsing 'instructions'. ${error.message}`,
            });
        }

        // const tag = JSON.parse(_tag)
        // const instructions = JSON.parse(_instructions)
        // console.log("tag" + tag);
        // console.log("instructions" + instructions);

        //validation
        if (!courseDescription || !courseName || !whatYouWillLearn || !price || !tag.length || !thumbnail || !category) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        if (!status || status === undefined) {
            status = "Draft"
        }

        //check for instructor
        const userId = req.user.id;

        const instructorDetails = await User.findById(userId, { accountType: "Instructor" });
        console.log("Instructor Details: ", instructorDetails);
        //TODO: Verify that userId and instructorDetails._id are same or different ?

        if (!instructorDetails) {
            return res.status(404).json({
                success: false,
                message: "Instructor Details not found ",
            })
        }

        //check given tag is valid or not
        const categoryDetails = await Category.findById(category);
        if (!categoryDetails) {
            return res.status(404).json({
                success: false,
                message: "Category Details not found",
            })
        }

        //Upload Image to Cloudinary
        const thumbnailImage = await uploadImageToCloudinary(thumbnail, process.env.FOLDER_NAME);

        //create an entry new Course
        const newCourse = await Course.create({
            courseName,
            courseDescription,
            instructor: instructorDetails._id,
            whatYouWillLearn,
            price,
            tag,
            category: categoryDetails._id,
            thumbnail: thumbnailImage.secure_url,
            status: status,
            instructions
        })

        //add the new course to the user Schema of instructor
        await User.findByIdAndUpdate(
            { _id: instructorDetails._id },
            {
                $push: {
                    courses: newCourse._id,
                }
            },
            { new: true },
        )

        //update the Category ka Schema 
        const categoryDetails2 = await Category.findByIdAndUpdate(
            { _id: category },
            {
                $push: {
                    course: newCourse._id,
                }
            },
            { new: true }
        )
        console.log("category schema : " + categoryDetails);

        //return response
        return res.status(200).json({
            success: true,
            message: "Course Created Successfully",
            data: newCourse,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Failed to create course",
            error: error.message,
        })
    }
}

// Edit Course Details
exports.editCourse = async (req, res) => {
    try {
        const { courseId } = req.body
        const updates = req.body
        const course = await Course.findById(courseId)

        if (!course) {
            return res.status(404).json({ error: "Course not found" })
        }

        // If Thumbnail Image is found, update it
        if (req.files) {
            console.log("thumbnail update")
            const thumbnail = req.files.thumbnailImage
            const thumbnailImage = await uploadImageToCloudinary(
                thumbnail,
                process.env.FOLDER_NAME
            )
            course.thumbnail = thumbnailImage.secure_url
        }

        // Update only the fields that are present in the request body
        for (const key in updates) {
            if (updates.hasOwnProperty(key)) {
                if (key === "tag" || key === "instructions") {
                    course[key] = JSON.parse(updates[key])
                } else {
                    course[key] = updates[key]
                }
            }
        }

        await course.save()

        const updatedCourse = await Course.findOne({
            _id: courseId,
        })
            .populate({
                path: "instructor",
                populate: {
                    path: "additionalDetails",
                },
            })
            .populate("category")
            .populate("ratingAndReviews")
            .populate({
                path: "courseContent",
                populate: {
                    path: "subSection",
                },
            })
            .exec()

        return res.json({
            success: true,
            message: "Course updated successfully",
            data: updatedCourse,
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        })
    }
}

// Get Course List getAllCourse handler function
exports.getAllCourses = async (req, res) => {
    try {
        const allCourses = await Course.find(
            { status: "Published" },
            {
                courseName: true,
                price: true,
                thumbnail: true,
                instructor: true,
                ratingAndReviews: true,
                studentsEnrolled: true,
            }
        )
            .populate("instructor")
            .exec()

        return res.status(200).json({
            success: true,
            data: allCourses,
        })
    } catch (error) {
        console.log(error)
        return res.status(404).json({
            success: false,
            message: `Can't Fetch Course Data`,
            error: error.message,
        })
    }
}

//getCourseDetails
exports.getCourseDetails = async (req, res) => {
    try {
      const { courseId } = req.body
      const courseDetails = await Course.findOne({
        _id: courseId,
      })
        .populate({
          path: "instructor",
          populate: {
            path: "additionalDetails",
          },
        })
        .populate("category")
        .populate("ratingAndReviews")
        .populate({
          path: "courseContent",
          populate: {
            path: "subSection",
            select: "-videoUrl",
          },
        })
        .exec()
  
      if (!courseDetails) {
        return res.status(400).json({
          success: false,
          message: `Could not find course with id: ${courseId}`,
        })
      }
  
      // if (courseDetails.status === "Draft") {
      //   return res.status(403).json({
      //     success: false,
      //     message: `Accessing a draft course is forbidden`,
      //   });
      // }
  
      let totalDurationInSeconds = 0
      courseDetails.courseContent.forEach((content) => {
        content.subSection.forEach((subSection) => {
          const timeDurationInSeconds = parseInt(subSection.timeDuration)
          totalDurationInSeconds += timeDurationInSeconds
        })
      })
  
      const totalDuration = convertSecondsToDuration(totalDurationInSeconds)
  
      return res.status(200).json({
        success: true,
        data: {
          courseDetails,
          totalDuration,
        },
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }
//getCourseDetails
// exports.getCourseDetails = async (req, res) => {
//     try {
//         //get Id
//         const { courseId } = req.body;
//         //find course details
//         const courseDetails = await Course.find({ _id: courseId })
//             .populate(
//                 {
//                     path: "instructor",
//                     populate: {
//                         path: "additionalDetails"
//                     }
//                 }
//             )
//             .populate("category")
//             .populate("ratingAndReviews")
//             .populate({
//                 path: "courseContent",
//                 populate: {
//                     path: "subSection",
//                     // select: "-videoUrl",
//                 }
//             })
//             .exec();

//         //validation
//         if (!courseDetails) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Cloud not find the Course with ${courseId}`,
//             })
//         }

//         // =================🛑🛑Error🛑🛑=====================
//         // let totalDurationInSeconds = 0
//         // courseDetails.courseContent.forEach((content) => {
//         //     console.log(content);
//         //     content.subSection.forEach((subSection) => {
//         //         const timeDurationInSeconds = parseInt(subSection.timeDuration)
//         //         totalDurationInSeconds += timeDurationInSeconds
//         //     })
//         // })

//         // const totalDuration = convertSecondsToDuration(totalDurationInSeconds)

//         //return response
//         return res.status(200).json({
//             success: true,
//             message: "Course Details fetched successfully",
//             data: {
//                 courseDetails,
//                 // totalDuration,
//             },
//         })


//     } catch (error) {
//         console.log(error);
//         return res.status(500).json({
//             success: false,
//             message: error.message,
//         })
//     }
// }

//getFullCourseDetails Handler function
exports.getFullCourseDetails = async (req, res) => {
    try {
        const { courseId } = req.body
        const userId = req.user.id
        const courseDetails = await Course.findOne({
            _id: courseId,
        })
            .populate({
                path: "instructor",
                populate: {
                    path: "additionalDetails",
                },
            })
            .populate("category")
            .populate("ratingAndReviews")
            .populate({
                path: "courseContent",
                populate: {
                    path: "subSection",
                },
            })
            .exec()

        let courseProgressCount = await CourseProgress.findOne({
            courseID: courseId,
            userId: userId,
        })

        console.log("courseProgressCount : ", courseProgressCount)

        if (!courseDetails) {
            return res.status(400).json({
                success: false,
                message: `Could not find course with id: ${courseId}`,
            })
        }

        // if (courseDetails.status === "Draft") {
        //   return res.status(403).json({
        //     success: false,
        //     message: `Accessing a draft course is forbidden`,
        //   });
        // }

        let totalDurationInSeconds = 0
        courseDetails.courseContent.forEach((content) => {
            content.subSection.forEach((subSection) => {
                const timeDurationInSeconds = parseInt(subSection.timeDuration)
                totalDurationInSeconds += timeDurationInSeconds
            })
        })

        const totalDuration = convertSecondsToDuration(totalDurationInSeconds)

        return res.status(200).json({
            success: true,
            data: {
                courseDetails,
                totalDuration,
                completedVideos: courseProgressCount?.completedVideos
                    ? courseProgressCount?.completedVideos
                    : [],
            },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// Get a list of Course for a given Instructor
exports.getInstructorCourses = async (req, res) => {
    try {
        // Get the instructor ID from the authenticated user or request body
        const instructorId = req.user.id

        // Find all courses belonging to the instructor
        const instructorCourses = await Course.find({
            instructor: instructorId,
        }).sort({ createdAt: -1 })

        // Return the instructor's courses
        res.status(200).json({
            success: true,
            data: instructorCourses,
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success: false,
            message: "Failed to retrieve instructor courses",
            error: error.message,
        })
    }
}

// Delete the Course
exports.deleteCourse = async (req, res) => {
    try {
        const { courseId } = req.body

        // Find the course
        const course = await Course.findById(courseId)
        if (!course) {
            return res.status(404).json({ message: "Course not found" })
        }

        // Unenroll students from the course
        const studentsEnrolled = course.studentsEnrolled; 
        for (const studentId of studentsEnrolled) {
            await User.findByIdAndUpdate(studentId, {
                $pull: { courses: courseId },
            })
        }

        // Delete sections and sub-sections
        const courseSections = course.courseContent;
        for (const sectionId of courseSections) {
            // Delete sub-sections of the section
            const section = await Section.findById(sectionId)
            if (section) {
                const subSections = section.subSection
                for (const subSectionId of subSections) {
                    await SubSection.findByIdAndDelete(subSectionId)
                }
            }

            // Delete the section
            await Section.findByIdAndDelete(sectionId)
        }

        //TODO : sreach the catogory section and pull the id

        // Delete the course
        await Course.findByIdAndDelete(courseId)
        //User courses section id deleted
        await User.findByIdAndUpdate(course.instructor,
            {
                $pull: { courses: courseId },
            }
        )

        return res.status(200).json({
            success: true,
            message: "Course deleted successfully",
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        })
    }
}