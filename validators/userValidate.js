import yup from "yup";

export const userSchema = yup.object({
  username: yup
    .string()
    .trim()
    .min(3, 'Username must be atleast 3 characters')
    .required('Username is required'),
  email: yup
    .string()
    .trim()
    .email('Please enter a valid email')
    .required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be atleast 8 characters')
    .required('Password is required'),
  role: yup
    .string()
    .oneOf(['student', 'tutor', 'admin'], 'Invalid role')
    .required('Role is required'),
});

export const validateUser = (schema) => async (req, res, next) => {
  try {
    await schema.validate(req.body)
    next();

  } catch (err) {
    return res.status(400).json({ errors: err.errors })
  }
}