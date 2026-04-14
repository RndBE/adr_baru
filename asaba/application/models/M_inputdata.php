<?php
class M_inputdata extends CI_Model{
	function __construct()
	{
		parent::__construct();
		$this->db = $this->load->database('default', true);
	}
	
function cek_sinkron($data)
	{
		$this->db->insert('cek_sinkron',$data);
		return;

	}
	
	function add_sinkron($data)
	{
		$this->db->insert('cek_sinkron',$data);
		return;

	}
	
	function update_sinkron($idlogger,$tanggal,$jam,$datasinkron)
	{
		$this->db->where('idlogger',$log_id);
		$this->db->where('tanggal',$tanggal);
		$this->db->where('jam',$jam);
		$this->db->update('cek_sinkron',$datasinkron);
		return;
	}
########################## Buat ARR #####################
function view_awr($log_id)
	{
		$awal=date('Y-m-d H:i',(mktime(0,0,0,date('m'),date('d'),date('Y'))));
        $this->db->select('*');
        $this->db->where('code_logger',$log_id);
		$this->db->where('waktu >=',$awal);
		$this->db->order_by('waktu','desc');
		$query=$this->db->get('awr');
		return $query;
	}
	
	function add_awr($data)
	{
		$this->db->insert('awr',$data);
		return;

	}
	function update_tempawr($idlogger,$data)
	{
		$this->db->where('code_logger',$idlogger);
		$this->db->update('temp_awr',$data);
		return;

	}
	
	########################## Buat AWLR #####################
function view_awlr($log_id)
	{
       $awal=date('Y-m-d H:i',(mktime(0,0,0,date('m'),date('d'),date('Y'))));
        $this->db->select('*');
        $this->db->where('code_logger',$log_id);
		$this->db->where('waktu >=',$awal);
		$this->db->order_by('waktu','desc');
		$query=$this->db->get('awlr');
		return $query;
	}
	
	function add_awlr($data)
	{
		$this->db->insert('awlr',$data);
		return;

	}
	function update_tempawlr($idlogger,$data)
	{
		$this->db->where('code_logger',$idlogger);
		$this->db->update('temp_awlr',$data);
		return;

	}
	
	########################## Buat AFMR #####################
function view_afmr($log_id)
	{
       $awal=date('Y-m-d H:i',(mktime(0,0,0,date('m'),date('d'),date('Y'))));
        $this->db->select('*');
        $this->db->where('code_logger',$log_id);
		$this->db->where('waktu >=',$awal);
		$this->db->order_by('waktu','desc');
		$query=$this->db->get('afmr');
		return $query;
	}
	
	function add_afmr($data)
	{
		$this->db->insert('afmr',$data);
		return;

	}
	function update_tempafmr($idlogger,$data)
	{
		$this->db->where('code_logger',$idlogger);
		$this->db->update('temp_afmr',$data);
		return;

	}
	
	
		#################### CRUD #########################################
	function edit_data_awlr($where,$table){		
		return $this->db->get_where($table,$where);
	}
	
	function update_data_awlr_crud($where,$data,$table){
		//echo $data;
		$this->db->where($where);
		$this->db->update($table,$data);
	}	
	
	function hapus_awlr($where,$table){
		$this->db->where($where);
		$this->db->delete($table);
	}
	
	function edit_data_arr($where,$table){		
		return $this->db->get_where($table,$where);
	}
	
	function update_data_arr_crud($where,$data,$table){
		//echo $data;
		$this->db->where($where);
		$this->db->update($table,$data);
	}	
	
	function hapus_arr($where,$table){
		$this->db->where($where);
		$this->db->delete($table);
	}
	
		function update_sn($idlogger,$data)
	{
		$this->db->where('logger_id',$idlogger);
		$this->db->update('t_informasi',$data);
		return;

	}
	
	function edit_data_info($where) {
		//$q_info=$this->db->query("SELECT * FROM `t_logger` join t_info on t_logger.id_logger=t_info.logger_id join t_lokasi on t_logger.lokasi_logger=t_lokasi.idlokasi where id='".$where."'");
		//return $q_info;
		return $this->db->query("SELECT t_logger.*,t_informasi.*,t_lokasi.*,t_garansi.tgl_kontrak,t_garansi.no_kontrak,t_garansi.tgl_aktif,t_garansi.garansi FROM `t_logger` join t_informasi on t_logger.id_logger=t_informasi.logger_id join t_lokasi on t_logger.lokasi_logger=t_lokasi.idlokasi join t_garansi on t_logger.id_logger=t_garansi.id_logger where id='".$where."' group by t_logger.id_logger");

		//return $this->db->get_where($where);
	}

	function update_data_info($where1,$data1,$table1,$where2,$data2,$table2,$where3,$data3,$table3,$where4,$data4,$table4){
		//echo $data;
		$this->db->where($where1);
		$this->db->update($table1,$data1);

		$this->db->where($where2);
		$this->db->update($table2,$data2);

		$this->db->where($where3);
		$this->db->update($table3,$data3);

		$this->db->where($where4);
		$this->db->update($table4,$data4);

		//	print_r($where4);
		//	print_r($data4);
	}

	function tambah_data_info($data1,$table1,$data2,$table2,$data3,$table3){
		//echo $data;
		$this->db->insert($table1,$data1);

		$this->db->insert($table2,$data2);

		$this->db->insert($table3,$data3);
	}
	
	
	########### input SInkron  ###############
	function insert_ftp($data,$tabel) {
        $this->db->insert($tabel, $data);
	 	return;
    }
	
	function update_set($id,$data)
	{
		$this->db->where('idlogger', $id);
		$this->db->update('set_sinkronisasi',$data);
	}
	################################ END ###########################

 

}