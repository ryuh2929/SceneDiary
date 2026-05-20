return (
    <div className="h-full flex flex-col bg-white overflow-y-auto no-scrollbar">
      {/* Header */}
      <header className="flex items-center justify-between p-5 py-6">
        <button onClick={onBack} className="text-cobalt-950">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-diary font-bold text-cobalt-950">여행 기록 편집</h1>
        <button onClick={handleSave} className="text-[#6366f1] font-bold text-sm">저장</button>
      </header>

      <div className="px-5 pb-24 space-y-8">
        {/* Summary Card */}
        <div className="bg-[#f8f9fc] rounded-[2rem] p-4 flex gap-4 items-center">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-sm">
            <img src={data.mainImage} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <textarea
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
              className="w-full bg-transparent border-none p-0 text-lg font-bold text-cobalt-950 focus:ring-0 resize-none h-14 leading-tight font-diary"
              placeholder="제목 입력"
            />
          </div>
        </div>

        {/* Info Rows */}
        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold text-cobalt-400 ml-1">여행지</label>
            <div className="bg-[#f8f9fc] p-4 rounded-xl flex items-center gap-3 border border-transparent focus-within:border-cobalt-100">
              <input 
                type="text" 
                value={data.location} 
                onChange={(e) => setData({ ...data, location: e.target.value })}
                className="bg-transparent border-none p-0 text-xs font-medium focus:ring-0 flex-1 text-cobalt-800"
                placeholder="여행지"
              />
            </div>
          </div>
          <div className="flex-1 space-y-2 relative">
            <label className="text-xs font-bold text-cobalt-400 ml-1">날짜</label>
            <div className="bg-[#f8f9fc] p-4 rounded-xl flex items-center justify-between gap-2 border border-transparent focus-within:border-cobalt-100">
              <span className="text-xs font-medium text-cobalt-800">{data.date?.replace(/-/g, '.')}</span>
              <Calendar className="w-4 h-4 text-cobalt-400" />
            </div>
          </div>
        </div>

        {/* Weather Row */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-cobalt-400 ml-1">날씨</label>
          <div className="bg-[#f8f9fc] p-4 rounded-xl flex items-center gap-4">
            <div className="p-2 bg-white rounded-full shadow-sm">
              <Sun className="w-5 h-5 text-yellow-500 fill-current" />
            </div>
            <span className="text-sm font-bold text-cobalt-800">맑음 {data.weatherTemp}</span>
          </div>
        </div>

        {/* Travel Diary/Log Section */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-cobalt-400 ml-1">여행 기록</label>
          <div className="bg-[#f8f9fc] rounded-3xl overflow-hidden border border-cobalt-50">
            {/* Mock Toolbar */}
            <div className="flex items-center gap-4 p-4 border-b border-white px-6">
              <Bold className="w-4 h-4 text-cobalt-400" />
              <Italic className="w-4 h-4 text-cobalt-400" />
              <Underline className="w-4 h-4 text-cobalt-400" />
              <div className="w-[1px] h-4 bg-cobalt-100 mx-1" />
              <List className="w-4 h-4 text-cobalt-400" />
              <ListOrdered className="w-4 h-4 text-cobalt-400" />
            </div>
            {/* Content Area */}
            <div className="p-6">
              <textarea
                value={data.days?.[0]?.content}
                onChange={(e) => {
                  const newDays = [...(data.days || [])];
                  if (newDays[0]) {
                    newDays[0] = { ...newDays[0], content: e.target.value };
                    setData({ ...data, days: newDays });
                  }
                }}
                className="w-full bg-transparent border-none p-0 text-sm font-diary leading-relaxed text-cobalt-800 focus:ring-0 resize-none h-48"
                placeholder="오늘의 여정을 한 문장으로 정리해보세요."
              />
              <div className="flex justify-end mt-4">
                <span className="text-[10px] font-bold text-cobalt-300">{(data.days?.[0]?.content?.length || 0)}/1000</span>
              </div>
            </div>
          </div>
        </div>

        {/* Representative Photos */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-cobalt-400 ml-1">대표 사진</h3>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-cobalt-100">
               <img src={data.mainImage} alt="" className="w-full h-full object-cover" />
            </div>
            {data.days?.[0]?.images.slice(1).map((img, i) => (
              <div key={i} className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-cobalt-100">
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            <button className="w-16 h-16 rounded-xl border-2 border-dashed border-cobalt-100 flex items-center justify-center text-cobalt-300 bg-cobalt-50 shrink-0">
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 max-w-md w-full bg-white p-5 border-t border-cobalt-50">
        <button
          onClick={handleSave}
          className="w-full py-4 bg-[#6366f1] text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-[0_8px_30px_rgb(99,102,241,0.3)]"
        >
          저장하기 <FileText className="w-4 h-4 ml-1 opacity-80" />
        </button>
      </div>
    </div>
  );