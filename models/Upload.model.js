import mongoose from 'mongoose';
export default mongoose.model('Upload', new mongoose.Schema({ ownerId: { type: mongoose.Schema.Types.ObjectId, required: true }, url: { type: String, required: true } }, { timestamps: true }));
