const { mongoose } = require("mongoose");
const Category = require("../models/categoryModel");
function getRandomInt(max) {
    return Math.floor(Math.random() * max)
}


//createCategory section
exports.createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }
        const CategorysDetails = await Category.create({
            name: name,
            description: description,
        });
        console.log(CategorysDetails);
        return res.status(200).json({
            success: true,
            message: "Categorys Created Successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: true,
            message: error.message,
        });
    }
};

//showAllCategory section
exports.showAllCategories = async (req, res) => {
    try {
        console.log("INSIDE SHOW ALL CATEGORIES");
        const allCategorys = await Category.find({});
        res.status(200).json({
            success: true,
            data: allCategorys,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// categoryPageDetails
exports.categoryPageDetails = async (req, res) => {
    try {
        //get courseId
        const { categoryId } = req.body;
        //get courses for specified categoryId
        const selectedCategory = await Category.findById(categoryId)
            .populate({
                path: "course",
                match: { status: "Published" },
                populate: "ratingAndReviews",
            })
            .exec();
        //validation
        if (!selectedCategory) {
            return res.status(404).json({
                success: false,
                message: "Data Not Found",
            });
        }

        // Handle the case when there are no courses
        if (selectedCategory.course.length === 0) {
            console.log("No courses found for the selected category.")
            return res.status(404).json({
                success: false,
                message: "No courses found for the selected category.",
            })
        }

        //get courses for different categories
        const differentCategories = await Category.findOne({
            _id: { $ne: categoryId },
        })
            .populate("course")
            .exec();  
        // get top selling 
        const allCategories = await Category.find().populate({
            path: "course",
            match: { status: "Published" },
            populate: {
                path: "instructor",
            },
        }).exec()

        const allCourses = allCategories.flatMap((category) => category.course)
        const mostSellingCourse = allCourses.sort((a, b) => b.sold - a.sold).slice(0, 10)
        //TODO : HW write it on your own 
        // return response
        return res.status(200).json({
            success: true,
            data: {
                selectedCategory,
                differentCategories,
                mostSellingCourse
            },
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}